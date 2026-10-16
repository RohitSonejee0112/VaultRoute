import { z } from 'zod';

export const ClearanceLevelEnum = z.enum(['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED']);
export type ClearanceLevel = z.infer<typeof ClearanceLevelEnum>;

export const SlaTierEnum = z.enum(['P1', 'P2', 'P3']);
export type SlaTier = z.infer<typeof SlaTierEnum>;

export const DepartmentEnum = z.enum([
  'Wealth_Management',
  'Legal_Compliance',
  'Underwriting',
  'Client_Services',
  'Executive_Office'
]);
export type Department = z.infer<typeof DepartmentEnum>;

export const JurisdictionEnum = z.enum(['US', 'EU', 'APAC', 'GLOBAL']);
export type Jurisdiction = z.infer<typeof JurisdictionEnum>;

export const RecipientContextSchema = z.object({
  entityId: z.string().min(1),
  department: DepartmentEnum,
  clearanceLevel: ClearanceLevelEnum,
  jurisdiction: JurisdictionEnum,
  deliveryChannel: z.enum(['ENCRYPTED_PORTAL_DROP', 'SFTP_SECURE', 'API_WEBHOOK'])
});
export type RecipientContext = z.infer<typeof RecipientContextSchema>;

export const DocumentDeliveryRequestSchema = z.object({
  requestId: z.string().min(1),
  documentId: z.string().min(1),
  documentType: z.string().min(1),
  classification: ClearanceLevelEnum,
  requiredDepartment: DepartmentEnum.optional(),
  allowedJurisdictions: z.array(JurisdictionEnum).default(['US', 'EU', 'APAC', 'GLOBAL']),
  priority: SlaTierEnum,
  sourceTeam: DepartmentEnum,
  targetPartner: z.string().min(1),
  recipient: RecipientContextSchema,
  payloadData: z.record(z.string(), z.unknown()),
  version: z.number().int().positive().default(1),
  timestamps: z.object({
    requestedAt: z.string().datetime(),
    slaDeadline: z.string().datetime()
  })
});
export type DocumentDeliveryRequest = z.infer<typeof DocumentDeliveryRequestSchema>;

export const DocumentStateEnum = z.enum([
  'REQUESTED',
  'VALIDATING',
  'REJECTED',
  'IN_TRANSIT',
  'RETRY_PENDING',
  'DELIVERED',
  'FAILED_BREACH'
]);
export type DocumentState = z.infer<typeof DocumentStateEnum>;
