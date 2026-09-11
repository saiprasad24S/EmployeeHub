export interface EmployeeProfile {
  id: number;
  employee_id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  profile_photo: string;
  shift_name: string;
  shift_start_time: string;
  shift_end_time: string;
  default_address: string;
  default_latitude?: number;
  default_longitude?: number;
  default_radius?: number;
  weekly_off_days?: string[];
  face_embedding?: { registered: boolean };
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceRecord {
  id: number;
  employee: number;
  attendance_type: 'CHECK_IN' | 'CHECK_OUT';
  photo_url?: string;
  latitude: number;
  longitude: number;
  address?: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  timestamp: string;
  remarks?: string;
}

export interface Session {
  id: number;
  employee_id: number;
  login_time: string;
  logout_time?: string;
  is_active: boolean;
}

export interface MonthlyAttendanceDay {
  date: string;
  status: 'PRESENT' | 'UNMARKED';
  check_in_time?: string;
  check_out_time?: string;
  total_hours?: number;
}

export interface Assignment {
  id: number;
  patient_name: string;
  patient_phone: string;
  patient_address: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  visit_date: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  employee: number;
}

export interface LeaveRequest {
  id: number;
  leave_type: 'CASUAL' | 'SICK' | 'MATERNITY_PATERNITY' | 'BEREAVEMENT' | 'UNPAID';
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
  applied_at: string;
  reviewed_at?: string;
}

export interface LeaveSummary {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  reference_id?: number;
  is_read: boolean;
  created_at: string;
}

export interface DashboardMetrics {
  total_employees: number;
  active_employees: number;
  pending_leaves: number;
}
