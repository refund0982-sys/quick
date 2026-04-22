export interface CampaignRequest {
  campaignId: string;
  recipients: string[];
  subject: string;
  html: string;
  smtpConfigs?: any[];
  attachments?: { filename: string; content: string; contentType: string }[];
  senderNames?: string[];
}

export async function sendCampaign(data: CampaignRequest) {
  const response = await fetch("/api/send-campaign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to send campaign");
  }

  return response.json();
}

export async function checkServerHealth() {
  const response = await fetch("/api/health");
  return response.json();
}
