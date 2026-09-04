import { prisma } from './db';

type AuditInput = {
  tournamentId?: string;
  userId?: string;
  entityType: string;
  entityId: string;
  action: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      tournamentId: input.tournamentId,
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      previousValue: input.previousValue as object | undefined,
      newValue: input.newValue as object | undefined,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent
    }
  });
}
