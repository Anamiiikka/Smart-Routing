import { z } from "zod";
import { Priority, TicketStatus } from "@prisma/client";

export const createTicketSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(5).max(5000),
  priority: z.nativeEnum(Priority).optional(),
});

export const updateTicketSchema = z
  .object({
    status: z.nativeEnum(TicketStatus).optional(),
    assigneeId: z.string().cuid().optional(),
    priority: z.nativeEnum(Priority).optional(),
  })
  .refine((v) => v.status || v.assigneeId || v.priority, {
    message: "Provide at least one field to update",
  });

export const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

export const listTicketsQuerySchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  mine: z.coerce.boolean().optional(),
});
