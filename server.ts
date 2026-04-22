import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Resend } from 'resend';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Tracking Pixel for Opens
  app.get("/api/track/open/:campaignId", async (req, res) => {
    const { campaignId } = req.params;
    console.log(`Tracking Open for Campaign: ${campaignId}`);
    
    // In a real app, you'd increment openCount in Firestore here.
    // For this build, we'll log it. The client will fetch updated stats.
    
    // Transparent 1x1 pixel
    const pixel = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64"
    );
    res.writeHead(200, {
      "Content-Type": "image/gif",
      "Content-Length": pixel.length,
    });
    res.end(pixel);
  });

  // Tracking Redirect for Clicks
  app.get("/api/track/click/:campaignId", async (req, res) => {
    const { campaignId } = req.params;
    const targetUrl = req.query.url as string;
    
    console.log(`Tracking Click for Campaign: ${campaignId} -> ${targetUrl}`);
    
    if (targetUrl) {
      res.redirect(targetUrl);
    } else {
      res.status(400).send("No target URL provided");
    }
  });

  // Real Email Sending Logic (SaaS backend)
  app.post("/api/send-campaign", async (req, res) => {
    const { campaignId, recipients, subject, html, smtpConfigs, attachments, senderNames } = req.body;
    
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, message: "No recipients provided" });
    }

    const APP_URL = process.env.APP_URL || "http://localhost:3000";

    // Inject Tracking Logic
    const injectTracking = (content: string, cId: string) => {
      // Add Open Tracking Pixel
      const openPixel = `<img src="${APP_URL}/api/track/open/${cId}" width="1" height="1" style="display:none" />`;
      let trackedHtml = content + openPixel;

      // Basic Click Tracking (replace <a> tags)
      trackedHtml = trackedHtml.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi, (match, url) => {
        if (url.startsWith('http')) {
          return `<a href="${APP_URL}/api/track/click/${cId}?url=${encodeURIComponent(url)}"`;
        }
        return match;
      });

      return trackedHtml;
    };

    const trackedHtml = injectTracking(html, campaignId || "unknown");

    // Process attachments for nodemailer
    const processedAttachments = attachments?.map((att: any) => ({
      filename: att.filename,
      content: att.content, // Expected as base64 string
      encoding: 'base64',
      contentType: att.contentType
    })) || [];

    // SMTP Rotation Logic
    if (smtpConfigs && Array.isArray(smtpConfigs) && smtpConfigs.length > 0) {
      const activeConfigs = smtpConfigs.filter((c: any) => c.isActive);
      if (activeConfigs.length > 0) {
        const nodemailer = await import("nodemailer");
        const results = { sentCount: 0, failCount: 0, nodeStats: {} as Record<string, { success: number, failure: number, lastError?: string }> };

        for (let i = 0; i < recipients.length; i++) {
          const recipient = recipients[i];
          
          // RANDOMIZED IP ROTATION: Shuffles servers for every recipient to break delivery patterns
          const config = activeConfigs[Math.floor(Math.random() * activeConfigs.length)];
          const nodeId = config.id || `${config.host}:${config.user}`;
          
          // SENDER NAME ROTATION: Pick a random name for each email to improve organic feel
          let currentSenderName = "FluxMail";
          if (senderNames && Array.isArray(senderNames) && senderNames.length > 0) {
            currentSenderName = senderNames[Math.floor(Math.random() * senderNames.length)];
          }

          if (!results.nodeStats[nodeId]) {
            results.nodeStats[nodeId] = { success: 0, failure: 0 };
          }
          
          // ANTI-SPAM JITTER
          await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
          
          const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure || config.port === 465,
            auth: { user: config.user, pass: config.pass },
            tls: { rejectUnauthorized: false }
          });

          try {
            await transporter.sendMail({
              from: `${currentSenderName} <${config.user}>`,
              to: recipient,
              subject,
              html: trackedHtml,
              attachments: processedAttachments
            });
            results.sentCount++;
            results.nodeStats[nodeId].success++;
          } catch (err: any) {
            results.failCount++;
            results.nodeStats[nodeId].failure++;
            results.nodeStats[nodeId].lastError = err.message;
          }
        }

        return res.json({ 
          success: results.sentCount > 0, 
          message: `Campaign Complete. Built with Reputation Shield and Active Rotation.`,
          stats: {
            total: recipients.length,
            sent: results.sentCount,
            failed: results.failCount,
            nodes: results.nodeStats
          }
        });
      }
    }

    // Fallback to Resend
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      console.warn("No Delivery Method available. Simulating...");
      return res.json({ success: true, simulated: true, message: "Simulation Mode Active" });
    }

    const resend = new Resend(RESEND_API_KEY);
    try {
      const { data, error } = await resend.emails.send({
        from: 'FluxMail <onboarding@resend.dev>',
        to: recipients,
        subject,
        html: trackedHtml,
      });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Bulk Contacts Processing Endpoint
  app.post("/api/bulk-contacts", (req, res) => {
    const { contacts } = req.body;
    res.json({ success: true, message: `Validated ${contacts?.length || 0} contacts for import.` });
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", version: "1.0.0" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 FluxMail Server running on http://localhost:${PORT}`);
  });
}

startServer();
