import { create } from 'zustand';

interface PatientData {
  clientId: string;
  pressure?: { systolic: number; diastolic: number };
  bloodSugar?: number;
  pulse?: number;
  lastUpdate?: string;
}

interface PatientStore {
  patients: Record<string, PatientData>;
  totalPatients: number;
  newToday: number;
  criticalCases: number;
  averagePulse: number;
  loading: boolean;
  updatePatients: (newPatients: Record<string, PatientData>) => void;
}

export const usePatientStore = create<PatientStore>((set) => ({
  patients: {},
  totalPatients: 0,
  newToday: 0,
  criticalCases: 0,
  averagePulse: 0,
  loading: false,
  updatePatients: (newPatients) => {
    // Пересчитываем статистику при обновлении
    const patientList = Object.values(newPatients);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    set({
      patients: newPatients,
      totalPatients: patientList.length,
      newToday: patientList.filter(
        (p) => p.lastUpdate && new Date(p.lastUpdate) >= today
      ).length,
      criticalCases: patientList.filter(
        (p) =>
          (p.pulse && (p.pulse > 120 || p.pulse < 50)) ||
          (p.bloodSugar && (p.bloodSugar > 10 || p.bloodSugar < 3.5)) ||
          (p.pressure && (p.pressure.systolic > 140 || p.pressure.diastolic > 90))
      ).length,
      averagePulse: patientList.reduce((sum, p) => sum + (p.pulse || 0), 0) / patientList.length || 0,
    });
  },
}));