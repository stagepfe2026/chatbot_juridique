export type AuditLogStatus = "SUCCESS" | "FAILED" | "WARNING";
export type AuditLogLevel = "INFO" | "CRITICAL";
export type AuditExportFormat = "pdf" | "excel" | "json";

export interface AuditLogDetails {
  message: string;
  endpoint?: string;
  payload?: Record<string, unknown>;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  resource: string;
  status: AuditLogStatus;
  level: AuditLogLevel;
  ip: string;
  timestamp: string;
  details: AuditLogDetails;
}
