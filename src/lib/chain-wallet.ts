/**
 * Path A — self-custody chain wallet (spike, branch only).
 *
 * Each doctor and pharmacy holds their own Cardano key in the browser. The
 * backend builds an unsigned transaction, this wallet adds the user's witness,
 * and the backend co-signs and submits. The on-chain policy requires that
 * witness, so the backend can't mint or burn in the user's name.
 *
 * The wallet holds no ADA and needs no provider — it only produces signatures,
 * so there is nothing to fund.
 *
 * KNOWN LIMITATION, state it in the demo: the mnemonic is stored in IndexedDB.
 * That is acceptable for a preprod demo, not for production — a real build
 * would use a non-extractable key or a external wallet. This is deliberately
 * the one weak point, and it is called out rather than hidden.
 *
 * @meshsdk/core is imported dynamically inside each function so it never lands
 * in the server bundle: this whole module is browser-only (IndexedDB), and the
 * library is heavy enough that keeping it off the server matters.
 */

// A separate database from the custodial signing store (`pacy`/`signing-keys`
// on main) so a spike branch can't corrupt or version-conflict with it.
const DB_NAME = "pacy-chain";
const STORE = "wallets";
const PREPROD_NETWORK_ID = 0;

export class ChainWalletUnavailableError extends Error {
  constructor() {
    super(
      "This browser can't create a chain wallet. It needs IndexedDB and a modern browser.",
    );
    this.name = "ChainWalletUnavailableError";
  }
}

export function isChainWalletAvailable(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

/* ---------------------------------------------------------------- storage */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/** Scoped by user id: a shared device with two accounts must not cross-wire. */
function storageKey(userId: string): string {
  return `pacy.chainWallet.${userId}`;
}

/** The 24-word mnemonic, or null if this device holds none for this user. */
async function loadMnemonic(userId: string): Promise<string[] | null> {
  if (!isChainWalletAvailable()) return null;
  try {
    const stored = await idbRequest<string[] | undefined>("readonly", (s) =>
      s.get(storageKey(userId)),
    );
    return stored ?? null;
  } catch {
    return null;
  }
}

async function storeMnemonic(userId: string, words: string[]): Promise<void> {
  await idbRequest("readwrite", (s) => s.put(words, storageKey(userId)));
}

/* ------------------------------------------------------------- mesh glue */

/**
 * Mesh's core-cst inlines the Node build of `b4a`, which calls a global
 * `Buffer`. Node has one; Turbopack's browser bundle does not, so the wallet
 * path would throw `Buffer is not defined` at call time. Install the polyfill
 * before any Mesh code runs — idempotent, and scoped to Path A so it never
 * touches the custodial flow.
 */
let bufferReady: Promise<void> | null = null;
function ensureBrowserGlobals(): Promise<void> {
  bufferReady ??= (async () => {
    const g = globalThis as { Buffer?: unknown };
    if (typeof g.Buffer === "undefined") {
      const { Buffer } = await import("buffer");
      g.Buffer = Buffer;
    }
  })();
  return bufferReady;
}

async function importMesh() {
  await ensureBrowserGlobals();
  return import("@meshsdk/core");
}

// MeshWallet reconstruction is not free; cache the built wallet per user so
// repeated signs don't rebuild it from the mnemonic each time.
type MeshWalletInstance = {
  init?: () => Promise<void>;
  getChangeAddress: () => Promise<string>;
  signTx: (unsignedTx: string, partialSign?: boolean) => Promise<string>;
};
const walletCache = new Map<string, MeshWalletInstance>();

async function buildWallet(words: string[]): Promise<MeshWalletInstance> {
  const { MeshWallet } = await importMesh();
  const wallet = new MeshWallet({
    networkId: PREPROD_NETWORK_ID,
    key: { type: "mnemonic", words },
  }) as unknown as MeshWalletInstance;
  // Mesh >= 1.8 requires an explicit init before address derivation.
  await wallet.init?.();
  return wallet;
}

async function walletFor(userId: string): Promise<MeshWalletInstance | null> {
  const cached = walletCache.get(userId);
  if (cached) return cached;

  const words = await loadMnemonic(userId);
  if (!words) return null;

  const wallet = await buildWallet(words);
  walletCache.set(userId, wallet);
  return wallet;
}

/** The wallet's on-chain identity, derived deterministically from the seed. */
export interface ChainIdentity {
  address: string;
  /** 56 hex chars — what the backend writes into the on-chain allow-list. */
  keyHash: string;
}

async function identityOf(wallet: MeshWalletInstance): Promise<ChainIdentity> {
  const { deserializeAddress } = await importMesh();
  const address = await wallet.getChangeAddress();
  const { pubKeyHash } = deserializeAddress(address);
  return { address, keyHash: pubKeyHash };
}

/* ------------------------------------------------------------ public API */

/** Whether this device already holds a wallet for this user, and its identity. */
export async function getLocalChainIdentity(
  userId: string,
): Promise<ChainIdentity | null> {
  const wallet = await walletFor(userId);
  if (!wallet) return null;
  return identityOf(wallet);
}

/**
 * Generate a wallet, persist its mnemonic, and return the on-chain identity to
 * enrol. Overwrites any existing seed for this user — a new device deliberately
 * gets a fresh key, which the backend allow-list simply gains.
 */
export async function generateChainWallet(
  userId: string,
): Promise<ChainIdentity> {
  if (!isChainWalletAvailable()) throw new ChainWalletUnavailableError();

  const { MeshWallet } = await importMesh();
  const words = MeshWallet.brew() as string[];
  await storeMnemonic(userId, words);

  const wallet = await buildWallet(words);
  walletCache.set(userId, wallet);
  return identityOf(wallet);
}

/**
 * Add this user's witness to an unsigned transaction from the backend.
 *
 * `partialSign = true` is required: the backend co-signs with its own key
 * afterwards, so this must not finalise the transaction.
 */
export async function signTransaction(
  userId: string,
  unsignedTx: string,
): Promise<string> {
  if (!isChainWalletAvailable()) throw new ChainWalletUnavailableError();

  const wallet = await walletFor(userId);
  if (!wallet) {
    throw new Error("No chain wallet on this device.");
  }
  return wallet.signTx(unsignedTx, true);
}
