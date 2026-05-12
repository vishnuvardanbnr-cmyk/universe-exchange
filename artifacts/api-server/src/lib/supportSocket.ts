import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import { logger } from "./logger";

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high";
  createdAt: number;
  updatedAt: number;
  messages: TicketMessage[];
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  sender: "user" | "support";
  senderName: string;
  body: string;
  timestamp: number;
}

export const tickets: Map<string, SupportTicket> = new Map();

let ticketWss: WebSocketServer | null = null;
const ticketClients: Map<string, Set<WebSocket>> = new Map();

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function genMsgId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

function broadcastToTicket(ticketId: string, payload: any) {
  const clients = ticketClients.get(ticketId);
  if (!clients) return;
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

export function broadcastToTicketExternal(ticketId: string, payload: any) {
  broadcastToTicket(ticketId, payload);
}

export function createTicket(userId: string, userName: string, subject: string, firstMessage: string): SupportTicket {
  const ticketId = genId();
  const now = Date.now();
  const ticket: SupportTicket = {
    id: ticketId,
    userId,
    userName,
    subject,
    status: "open",
    priority: "medium",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: genMsgId(),
        ticketId,
        sender: "user",
        senderName: userName,
        body: firstMessage,
        timestamp: now,
      },
      {
        id: genMsgId(),
        ticketId,
        sender: "support",
        senderName: "CryptoX Support",
        body: `Hi ${userName}! Thank you for reaching out. I can see your message about "${subject}". A support agent will assist you shortly. Our average response time is under 2 minutes.`,
        timestamp: now + 2000,
      },
    ],
  };
  tickets.set(ticketId, ticket);
  logger.info({ ticketId, userId, subject }, "Support ticket created");
  return ticket;
}

export function setupSupportWebSocket(server: http.Server) {
  ticketWss = new WebSocketServer({ server, path: "/api/ws/support" });

  ticketWss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "", `http://localhost`);
    const ticketId = url.searchParams.get("ticketId") ?? "";
    const isAdmin = url.searchParams.get("adminKey") === (process.env["ADMIN_SECRET"] ?? "cryptox-admin-2024");
    const userName = url.searchParams.get("userName") ?? "User";

    logger.info({ ticketId, isAdmin }, "Support WS connection");

    if (!ticketClients.has(ticketId)) ticketClients.set(ticketId, new Set());
    ticketClients.get(ticketId)!.add(ws);

    const ticket = tickets.get(ticketId);
    if (ticket) {
      ws.send(JSON.stringify({ type: "ticket_state", ticket }));
      if (isAdmin && ticket.status === "open") {
        ticket.status = "in_progress";
        ticket.updatedAt = Date.now();
        broadcastToTicket(ticketId, { type: "status_changed", status: "in_progress" });
      }
    } else {
      ws.send(JSON.stringify({ type: "error", message: "Ticket not found" }));
    }

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "send_message") {
          const ticket = tickets.get(ticketId);
          if (!ticket) return;
          const newMsg: TicketMessage = {
            id: genMsgId(),
            ticketId,
            sender: isAdmin ? "support" : "user",
            senderName: isAdmin ? "CryptoX Support" : userName,
            body: String(msg.body ?? "").slice(0, 2000),
            timestamp: Date.now(),
          };
          ticket.messages.push(newMsg);
          ticket.updatedAt = Date.now();
          broadcastToTicket(ticketId, { type: "new_message", message: newMsg });
        } else if (msg.type === "close_ticket" && isAdmin) {
          const ticket = tickets.get(ticketId);
          if (ticket) {
            ticket.status = "resolved";
            ticket.updatedAt = Date.now();
            broadcastToTicket(ticketId, { type: "status_changed", status: "resolved" });
          }
        } else if (msg.type === "typing") {
          broadcastToTicket(ticketId, { type: "typing", sender: isAdmin ? "support" : "user", senderName: isAdmin ? "Support" : userName });
        }
      } catch (err) {
        logger.warn({ err }, "Support WS message parse error");
      }
    });

    ws.on("close", () => {
      ticketClients.get(ticketId)?.delete(ws);
    });
  });

  logger.info("Support WebSocket ready at /api/ws/support");
}
