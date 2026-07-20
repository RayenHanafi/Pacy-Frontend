import { PrescriptionHistory } from "@/components/patient/prescription-history";
import { QrCard } from "@/components/patient/qr-card";

export default function PatientHome() {
  return (
    <div className="space-y-4">
      <QrCard />
      <PrescriptionHistory />
    </div>
  );
}
