import { Router } from "express";
import { createTicket, tickets, broadcastToTicketExternal } from "../lib/supportSocket";
import { logger } from "../lib/logger";

const ADMIN_KEY = process.env["ADMIN_SECRET"] ?? "cryptox-admin-2024";

function isAdmin(req: any): boolean {
  return req.headers["x-admin-key"] === ADMIN_KEY;
}

const router = Router();

router.post("/support/tickets", (req, res) => {
  const { userId, userName, subject, firstMessage } = req.body;
  if (!userId || !subject || !firstMessage) {
    return res.status(400).json({ error: "userId, subject, and firstMessage are required" });
  }
  const ticket = createTicket(
    String(userId),
    String(userName ?? "Anonymous"),
    String(subject).slice(0, 200),
    String(firstMessage).slice(0, 2000),
  );
  res.status(201).json({ ticket });
});

router.get("/support/tickets", (req, res) => {
  const { userId } = req.query;
  if (isAdmin(req)) {
    const all = Array.from(tickets.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    return res.json({ tickets: all });
  }
  if (!userId) return res.status(400).json({ error: "userId required" });
  const userTickets = Array.from(tickets.values())
    .filter((t) => t.userId === String(userId))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  res.json({ tickets: userTickets });
});

router.get("/support/tickets/:id", (req, res) => {
  const ticket = tickets.get(req.params["id"]);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  res.json({ ticket });
});

router.patch("/support/tickets/:id", (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: "Forbidden" });
  const ticket = tickets.get(req.params["id"]);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  const { status, priority } = req.body;
  if (status) ticket.status = status;
  if (priority) ticket.priority = priority;
  ticket.updatedAt = Date.now();
  logger.info({ id: req.params["id"], status, priority }, "Ticket updated by admin");
  res.json({ ticket });
});

// POST /api/support/tickets/:id/messages — send a message via REST (fallback when WS unavailable)
router.post("/support/tickets/:id/messages", (req, res) => {
  const ticket = tickets.get(req.params["id"]);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  const admin = isAdmin(req);
  const { body, userName } = req.body;
  if (!body || !String(body).trim()) return res.status(400).json({ error: "body required" });

  const newMsg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    ticketId: ticket.id,
    sender: admin ? "support" : "user",
    senderName: admin ? "CryptoX Support" : (String(userName ?? "User")),
    body: String(body).slice(0, 2000),
    timestamp: Date.now(),
  };

  ticket.messages.push(newMsg as any);
  ticket.updatedAt = Date.now();

  broadcastToTicketExternal(ticket.id, { type: "new_message", message: newMsg });

  res.status(201).json({ message: newMsg, ticket: { ...ticket } });
});

export default router;
