/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  BarChart3, 
  Send, 
  Users, 
  LayoutDashboard, 
  Settings, 
  Plus,
  Mail,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  LogOut,
  LogIn,
  Server,
  Upload,
  ShieldCheck,
  Zap
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { sendCampaign } from "@/src/services/api";
import { auth, getSMTPConfigs, saveSMTPConfig, SMTPConfig, saveBulkContacts } from "@/src/lib/firebase";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const CAMPAIGNS = [
  { id: '1', name: 'Spring Sale 2026', status: 'sent', date: 'Apr 20, 2026', sent: 45200, opens: 11200, clicks: 2100 },
  { id: '2', name: 'Weekly Newsletter', status: 'active', date: 'Apr 21, 2026', sent: 12000, opens: 3400, clicks: 800 },
  { id: '3', name: 'Product Launch', status: 'sent', date: 'Apr 18, 2026', sent: 67692, opens: 15400, clicks: 3200 },
];

const CONTACTS = [
  { email: 'alex@example.com' },
  { email: 'sarah@company.co' },
  { email: 'm.ross@tech.io' },
  { email: 'jane.doe@web.net' },
  { email: 'kyle@startup.com' },
  { email: 'lisa@agency.org' },
  { email: 'victor@cloud.edu' },
  { email: 'emma@marketing.biz' },
  { email: 'sam@developer.dev' },
  { email: 'chris@founder.vc' },
];

// Enhanced STATS for the Bento Grid
const STATS = [
  { label: "Total Sent", value: "124,892", change: "+12.5%", icon: Send },
  { label: "Open Rate", value: "24.5%", change: "+0.8%", icon: Mail, trend: [45, 52, 48, 61, 55, 67, 72] },
  { label: "Click Rate", value: "4.2%", change: "+0.3%", icon: BarChart3, trend: [12, 15, 14, 18, 16, 21, 24] },
  { label: "Deliverability", value: "98.2%", change: "+0.1%", icon: ShieldCheck },
];

const RECENT_ACTIVITY = [
  { id: 1, type: "open", contact: "alex@example.com", campaign: "Spring Sale", time: "2m ago" },
  { id: 2, type: "click", contact: "sarah@company.co", campaign: "Spring Sale", time: "5m ago" },
  { id: 3, type: "open", contact: "m.ross@tech.io", campaign: "Weekly Update", time: "12m ago" },
  { id: 4, type: "bounce", contact: "old@user.net", campaign: "Spring Sale", time: "1h ago" },
];

const SMTP_PRESETS = [
  { name: "Gmail", host: "smtp.gmail.com", port: 587, icon: Mail },
  { name: "Outlook/365", host: "smtp.office365.com", port: 587, icon: Zap },
  { name: "iCloud", host: "smtp.mail.me.com", port: 587, icon: ShieldCheck },
  { name: "GMX", host: "mail.gmx.net", port: 587, icon: Server },
  { name: "Edu (Google)", host: "smtp.gmail.com", port: 587, icon: Users },
];

const SEED_LIST = [
  "refund0982@gmail.com", // User's email as primary seed
  "test-placement-gmail@gmail.com",
  "test-placement-outlook@outlook.com",
  "test-placement-yahoo@yahoo.com"
];

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isBulkSMTPOpen, setIsBulkSMTPOpen] = useState(false);
  const [isAddSMTPOpen, setIsAddSMTPOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [smtpConfigs, setSmtpConfigs] = useState<SMTPConfig[]>([]);
  const [bulkEmails, setBulkEmails] = useState("");
  const [bulkSmtpText, setBulkSmtpText] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<any>(null);
  
  // SMTP Form State
  const [newSmtp, setNewSmtp] = useState({
    name: "",
    host: "",
    port: 587,
    user: "",
    pass: "",
    secure: false,
    isActive: true
  });

  useEffect(() => {
    if (auth) {
      return onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        if (currentUser) loadConfigs();
      });
    }
  }, []);

  const loadConfigs = async () => {
    const configs = await getSMTPConfigs();
    setSmtpConfigs(configs);
  };

  const handleAddSMTP = async () => {
    if (!newSmtp.name || !newSmtp.host || !newSmtp.user || !newSmtp.pass) {
      toast.error("All STMP fields are required");
      return;
    }
    await saveSMTPConfig({ ...newSmtp, ownerId: user?.uid || "" });
    toast.success("SMTP Configuration Added");
    setIsAddSMTPOpen(false);
    loadConfigs();
  };

  const handleBulkSMTPImport = async () => {
    const lines = bulkSmtpText.split("\n").filter(l => l.trim().length > 0);
    const configs: any[] = [];

    lines.forEach(line => {
      // Improved Parser: Handles Comma, Tab, or Colon separation
      const delimiter = line.includes("\t") ? "\t" : line.includes(",") ? "," : ":";
      const parts = line.split(delimiter);
      
      if (parts.length >= 2) {
        // Smart Parsing based on columns
        configs.push({
          host: (selectedPreset?.host || parts[0]?.trim()),
          port: (selectedPreset?.port || parseInt(parts[1]?.trim()) || 587),
          user: (selectedPreset ? parts[0]?.trim() : parts[2]?.trim()),
          pass: (selectedPreset ? parts[1]?.trim() : parts[3]?.trim()),
          name: (selectedPreset ? `${selectedPreset.name} Node` : parts[4]?.trim() || `Node ${parts[0]}`),
          isActive: true
        });
      }
    });

    if (configs.length === 0) {
      toast.error("No valid configurations detected");
      return;
    }

    const { saveBulkSMTPConfigs } = await import("@/src/lib/firebase");
    await saveBulkSMTPConfigs(configs);
    toast.success(`Cluster expanded: ${configs.length} nodes added`);
    setIsBulkSMTPOpen(false);
    setBulkSmtpText("");
    loadConfigs();
  };

  const handleBulkImport = async () => {
    const emails = bulkEmails.split(/[\n,]+/).map(e => e.trim()).filter(e => e.includes("@"));
    if (emails.length === 0) {
      toast.error("No valid emails found");
      return;
    }
    const contacts = emails.map(email => ({ email }));
    await saveBulkContacts(contacts);
    toast.success(`Imported ${emails.length} contacts`);
    setIsBulkImportOpen(false);
    setBulkEmails("");
  };

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success("Successfully signed in");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
  };
  
  // Form State
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    subject: "",
    senderNames: "",
    recipients: "",
    content: "",
    attachments: [] as { filename: string; content: string; contentType: string }[]
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileArray = Array.from(files) as File[];
    const processedFiles = await Promise.all(fileArray.map(async (file: File) => {
      return new Promise<{ filename: string; content: string; contentType: string }>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Content = (reader.result as string).split(',')[1];
          resolve({
            filename: file.name,
            content: base64Content,
            contentType: file.type
          });
        };
        reader.readAsDataURL(file);
      });
    }));

    setNewCampaign({
      ...newCampaign,
      attachments: [...newCampaign.attachments, ...processedFiles]
    });
    toast.success(`Attached ${files.length} files`);
  };

  const removeAttachment = (index: number) => {
    const updated = [...newCampaign.attachments];
    updated.splice(index, 1);
    setNewCampaign({ ...newCampaign, attachments: updated });
  };

  const handleSend = async (isTest: boolean = false) => {
    if (!newCampaign.name || !newCampaign.subject || (!isTest && !newCampaign.recipients) || !newCampaign.content) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSending(true);
    const recipientsArray = isTest ? SEED_LIST : newCampaign.recipients.split(',').map(e => e.trim());

    try {
      const result = await sendCampaign({
        campaignId: Date.now().toString(),
        recipients: recipientsArray,
        subject: isTest ? `[SEED TEST] ${newCampaign.subject}` : newCampaign.subject,
        html: `<div style="font-family: sans-serif;">${newCampaign.content}</div>`,
        smtpConfigs,
        attachments: newCampaign.attachments,
        senderNames: newCampaign.senderNames.split(',').map(n => n.trim()).filter(n => n.length > 0)
      });

      if (result.success) {
        toast.success(result.message || "Campaign sent successfully!");
        
        // Update local SMTP stats if nodes were used
        if (result.stats?.nodes) {
          const updatedConfigs = smtpConfigs.map(config => {
            const nodeId = config.id || `${config.host}:${config.user}`;
            const stats = result.stats.nodes[nodeId];
            if (stats) {
              return {
                ...config,
                successCount: (config.successCount || 0) + stats.success,
                failCount: (config.failCount || 0) + stats.failure,
                status: stats.failure > 0 && stats.success === 0 ? 'failing' : stats.success > 0 ? 'working' : config.status,
                lastResult: stats.lastError || (stats.success > 0 ? "Success" : config.lastResult),
                lastChecked: new Date()
              };
            }
            return config;
          });
          setSmtpConfigs(updatedConfigs as any);
        }

        if (!isTest) {
          setIsNewCampaignOpen(false);
          setNewCampaign({ name: "", subject: "", senderNames: "", recipients: "", content: "", attachments: [] });
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0F172A] flex-shrink-0 flex flex-col p-6 fixed h-full z-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-xl shadow-blue-600/30 ring-1 ring-blue-400/20">F</div>
          <span className="text-white font-bold text-xl tracking-tight italic">FluxMail</span>
        </div>
        
        <nav className="space-y-1.5 flex-grow">
          {[
            { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
            { id: "campaigns", icon: Send, label: "Campaigns" },
            { id: "audience", icon: Users, label: "Audience" },
            { id: "delivery", icon: Server, label: "Delivery Servers" },
            { id: "settings", icon: Settings, label: "Settings" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === item.id 
                ? "bg-blue-600/10 text-blue-400 shadow-[inset_0px_0px_12px_rgba(59,130,246,0.1)]" 
                : "text-[#94A3B8] hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <item.icon className={`w-4 h-4 ${activeTab === item.id ? "text-blue-400" : ""}`} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto border-t border-slate-800/60 pt-6 space-y-4">
          {!user ? (
            <button 
              onClick={handleLogin} 
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all"
            >
              <LogIn className="w-4 h-4" /> Sign In
            </button>
          ) : (
            <div className="flex items-center gap-3 p-2 bg-slate-800/40 rounded-xl border border-slate-800 group">
              <Avatar className="w-9 h-9 border border-slate-700">
                <AvatarImage src={user.photoURL || ""} />
                <AvatarFallback className="bg-slate-700 text-[10px]">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-white truncate">{user.displayName || "User"}</p>
                <button onClick={handleLogout} className="text-[9px] font-bold text-slate-500 hover:text-rose-400 uppercase tracking-widest transition-colors">Sign Out</button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col ml-64 min-h-screen">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-10 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
            {activeTab === 'delivery' ? 'SMTP Rotation engine' : activeTab.toUpperCase()}
          </h1>
          <div className="flex items-center gap-4">
            <div className="px-4 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-[10px] font-black flex items-center gap-2">
              <Zap className="w-3 h-3 fill-blue-500 text-blue-500" />
              {smtpConfigs.length > 0 ? "ROTATION ACTIVE" : "SINGLE PROVIDER"}
            </div>
            
            <Dialog open={isNewCampaignOpen} onOpenChange={setIsNewCampaignOpen}>
              <DialogTrigger 
                render={
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl px-5 shadow-xl shadow-blue-600/20 h-10 tracking-wider">
                    LAUNCH CAMPAIGN
                  </Button>
                }
              />
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>New Email Campaign</DialogTitle>
                  <DialogDescription>Design and dispatch your campaign with automated SMTP rotation.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Input 
                    placeholder="Campaign Name (Internal)" 
                    value={newCampaign.name}
                    onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  />
                  <Input 
                    placeholder="Email Subject" 
                    value={newCampaign.subject}
                    onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                  />
                  <Input 
                    placeholder="Sender Names (e.g. Alex, Sarah, Marketing Team - comma separated)" 
                    value={newCampaign.senderNames}
                    onChange={(e) => setNewCampaign({ ...newCampaign, senderNames: e.target.value })}
                  />
                  <Input 
                    placeholder="Recipients (comma separated)" 
                    value={newCampaign.recipients}
                    onChange={(e) => setNewCampaign({ ...newCampaign, recipients: e.target.value })}
                  />
                  <textarea 
                    className="w-full h-40 rounded-xl border border-slate-200 p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Email HTML Content..."
                    value={newCampaign.content}
                    onChange={(e) => setNewCampaign({ ...newCampaign, content: e.target.value })}
                  />

                  {/* Attachment Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attachments (JPG, PDF)</p>
                      <label className="cursor-pointer">
                        <input 
                          type="file" 
                          multiple 
                          className="hidden" 
                          accept=".jpg,.jpeg,.png,.pdf" 
                          onChange={handleFileChange}
                        />
                        <span className="text-[10px] font-black text-blue-600 hover:text-blue-700 flex items-center gap-1">
                          <Plus className="w-3 h-3" /> ADD ASSETS
                        </span>
                      </label>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {newCampaign.attachments.map((file, i) => (
                        <div key={i} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 group transition-all hover:border-slate-300">
                          <div className="w-6 h-6 rounded bg-white border border-slate-100 flex items-center justify-center">
                            {file.contentType.includes('image') ? <Upload className="w-3 h-3 text-emerald-500" /> : <ShieldCheck className="w-3 h-3 text-blue-500" />}
                          </div>
                          <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">{file.filename}</span>
                          <button onClick={() => removeAttachment(i)} className="text-slate-300 hover:text-rose-500 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {newCampaign.attachments.length === 0 && (
                        <div className="w-full py-4 text-center border border-dashed border-slate-200 rounded-xl text-[10px] font-medium text-slate-400">
                          No assets attached (Images or Documents)
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none mb-1">Rotation</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase">{smtpConfigs.filter(c => c.isActive).length} Nodes Active</p>
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">IP Shield</p>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Active Randomization</p>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex-col gap-2">
                  <div className="flex gap-2 w-full">
                    <Button 
                      variant="outline"
                      className="flex-1 border-slate-200 h-12 font-bold text-slate-600"
                      onClick={() => handleSend(true)}
                      disabled={isSending}
                    >
                      <ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" />
                      SEED LIST TEST
                    </Button>
                    <Button 
                      className="flex-[2] bg-blue-600 h-12 font-bold" 
                      onClick={() => handleSend(false)}
                      disabled={isSending}
                    >
                      {isSending ? "Dispatching..." : "BEGIN ROTATION SEND"}
                    </Button>
                  </div>
                  <p className="text-[9px] text-center text-slate-400 font-medium">
                    Seed test sends to Gmail, Outlook, and Yahoo placement buckets.
                  </p>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-10 flex-1 overflow-auto"
          >
            {activeTab === "dashboard" && (
              <div className="grid grid-cols-12 gap-6 h-full auto-rows-fr">
                {/* 1. Primary Deliverability Bento (8 columns) */}
                <Card className="col-span-12 lg:col-span-8 p-8 flex flex-col justify-between border-slate-200/60 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] ring-1 ring-slate-100 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[100px] -mr-32 -mt-32"></div>
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-2">Overall Engine Performance</p>
                      <h2 className="text-5xl font-black text-slate-900 tracking-tighter">98.42% <span className="text-sm font-bold text-emerald-500 ml-2 tracking-normal">▲ 1.2%</span></h2>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold mb-2">PRISTINE REPUTATION</Badge>
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Global IP Tier 1</p>
                    </div>
                  </div>
                  
                  <div className="mt-12 flex items-end gap-2 h-40 relative z-10">
                    {[40, 55, 45, 70, 85, 90, 88, 94, 98, 96, 92, 94].map((h, i) => (
                      <div 
                        key={i} 
                        className={`flex-1 rounded-t-xl transition-all duration-700 hover:scale-y-105 cursor-pointer ${i > 7 ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.3)]' : 'bg-slate-200/70'}`} 
                        style={{ height: `${h}%` }}
                      ></div>
                    ))}
                  </div>
                </Card>

                {/* 2. Engagement Bento (4 columns) */}
                <Card className="col-span-12 lg:col-span-4 p-8 border-slate-200/60 bg-slate-900 text-white shadow-xl shadow-slate-900/10">
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-6">Real-Time Interaction</p>
                  <div className="space-y-6">
                    {RECENT_ACTIVITY.map((activity) => (
                      <div key={activity.id} className="flex items-center gap-4 group cursor-default">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${
                          activity.type === 'open' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20' : 
                          activity.type === 'click' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20' : 
                          'bg-rose-500/10 border-rose-500/20 text-rose-400'
                        }`}>
                          {activity.type === 'open' ? <Mail className="w-4 h-4" /> : activity.type === 'click' ? <Plus className="w-4 h-4 rotate-45" /> : <AlertCircle className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{activity.contact}</p>
                          <p className="text-[10px] text-slate-500 font-medium">opened <span className="text-white italic">"{activity.campaign}"</span></p>
                        </div>
                        <span className="text-[10px] font-black text-slate-600">{activity.time}</span>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" className="w-full mt-8 text-xs font-bold text-slate-400 hover:text-white border-t border-slate-800 rounded-none pt-4 h-auto">
                    VIEW FULL ACTIVITY LOG
                  </Button>
                </Card>

                {/* 3. Metrics Row */}
                {STATS.map((stat, i) => (
                  <Card key={i} className="col-span-12 md:col-span-6 lg:col-span-3 p-6 border-slate-200/60 hover:border-blue-200 group transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                        <stat.icon className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                      </div>
                      <span className="text-[10px] font-black text-emerald-500">{stat.change}</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{stat.value}</h3>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-1">{stat.label}</p>
                    
                    {stat.trend && (
                      <div className="mt-4 flex items-center gap-1 h-6">
                        {stat.trend.map((v, idx) => (
                          <div key={idx} className="w-full bg-blue-100 rounded-full" style={{ height: `${v}%` }}></div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}

                {/* 4. Infrastructure Status (4 columns) */}
                <Card className="col-span-12 lg:col-span-4 p-8 bg-blue-600 text-white shadow-2xl shadow-blue-600/20 overflow-hidden relative group">
                  <div className="absolute inset-0 bg-blue-700 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                  <Zap className="absolute -bottom-10 -right-10 w-40 h-40 text-blue-500/30 rotate-12" />
                  <div className="relative z-10">
                    <p className="text-[10px] uppercase font-black text-blue-200 tracking-widest mb-4">Delivery Node Status</p>
                    <h2 className="text-4xl font-black tracking-tighter mb-4">ULTRA-STABLE</h2>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span>LATENCY</span>
                        <span>14.2MS</span>
                      </div>
                      <div className="w-full h-1.5 bg-blue-400/30 rounded-full">
                        <div className="h-full bg-white rounded-full w-[88%] shadow-[0_0_8px_white]"></div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* 5. Campaign Pulse (8 columns) */}
                <Card className="col-span-12 lg:col-span-8 p-8 border-slate-200/60 flex flex-col justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em] mb-4">Live Campaign Comparison</p>
                    <div className="space-y-4">
                      {CAMPAIGNS.map(c => (
                        <div key={c.id} className="flex items-center gap-6">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 hidden md:block"></div>
                          <div className="w-32 text-sm font-bold truncate text-slate-700">{c.name}</div>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(c.opens / (c.sent || 1)) * 100}%` }}
                              className="h-full bg-blue-600"
                            ></motion.div>
                          </div>
                          <div className="w-16 text-[10px] font-black text-right text-slate-400">{Math.round((c.opens / (c.sent || 1)) * 100)}% OPEN</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === "delivery" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Delivery Infrastructure</h2>
                    <p className="text-sm text-slate-500 mt-1">Configure SMTP servers for automated sender rotation.</p>
                  </div>
                  <div className="flex gap-3">
                    <Dialog open={isBulkSMTPOpen} onOpenChange={setIsBulkSMTPOpen}>
                      <DialogTrigger 
                        render={
                          <Button variant="outline" className="gap-2 border-slate-200">
                            <Upload className="w-4 h-4" /> Bulk Add
                          </Button>
                        }
                      />
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Bulk Infrastructure Import</DialogTitle>
                          <DialogDescription>
                            Select a provider for automated preset configuration or use Custom for manual host settings.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-4 overflow-x-auto no-scrollbar">
                          <button
                            onClick={() => setSelectedPreset(null)}
                            className={`flex-shrink-0 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${!selectedPreset ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                          >
                            CUSTOM
                          </button>
                          {SMTP_PRESETS.map((p) => (
                            <button
                              key={p.name}
                              onClick={() => setSelectedPreset(p)}
                              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedPreset?.name === p.name ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
                            >
                              <p.icon className="w-3 h-3" />
                              {p.name}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Server</p>
                            <Input 
                              disabled 
                              value={selectedPreset ? selectedPreset.host : "Manual Entry Required"} 
                              className="bg-slate-50 text-xs font-mono"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SSL/TLS Port</p>
                            <Input 
                              disabled 
                              value={selectedPreset ? selectedPreset.port : 587} 
                              className="bg-slate-50 text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Dataset Input (One per line)
                          </p>
                          <div className="relative group">
                            <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none opacity-40 group-focus-within:opacity-10 transition-opacity">
                              <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 rounded">{selectedPreset ? "USERNAME" : "HOST:PORT"}</span>
                              <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 rounded">PASSWORD</span>
                              {!selectedPreset && <span className="text-[10px] font-mono uppercase bg-slate-100 px-2 rounded">NAME</span>}
                            </div>
                            <textarea 
                              className="min-h-[250px] w-full rounded-xl border border-slate-200 p-6 pt-10 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50/50"
                              placeholder={selectedPreset ? "user@example.com:password123\nsender2@gmail.com:app-pass-456" : "smtp.domain.com:587:user:pass:Node01"}
                              value={bulkSmtpText}
                              onChange={e => setBulkSmtpText(e.target.value)}
                            />
                          </div>
                        </div>

                        <DialogFooter className="mt-4">
                          <Button 
                            onClick={handleBulkSMTPImport} 
                            disabled={!bulkSmtpText.trim()}
                            className="w-full bg-blue-600 h-12 font-bold tracking-wide"
                          >
                            DEPLOY {bulkSmtpText.split('\n').filter(l => l.trim()).length} NODES TO CLUSTER
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isAddSMTPOpen} onOpenChange={setIsAddSMTPOpen}>
                      <DialogTrigger 
                        render={
                          <Button className="bg-slate-900 gap-2"><Plus className="w-4 h-4" /> Add Server</Button>
                        }
                      />
                      <DialogContent>
                        <DialogHeader><DialogTitle>Add SMTP Server</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                          <Input placeholder="Server Name (e.g. Amazon SES)" value={newSmtp.name} onChange={e => setNewSmtp({...newSmtp, name: e.target.value})} />
                          <div className="grid grid-cols-2 gap-4">
                            <Input placeholder="SMTP Host" value={newSmtp.host} onChange={e => setNewSmtp({...newSmtp, host: e.target.value})} />
                            <Input type="number" placeholder="Port" value={newSmtp.port} onChange={e => setNewSmtp({...newSmtp, port: parseInt(e.target.value)})} />
                          </div>
                          <Input placeholder="Username" value={newSmtp.user} onChange={e => setNewSmtp({...newSmtp, user: e.target.value})} />
                          <Input type="password" placeholder="Password" value={newSmtp.pass} onChange={e => setNewSmtp({...newSmtp, pass: e.target.value})} />
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddSMTP} className="w-full bg-blue-600">Save Configuration</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {smtpConfigs.map(config => (
                    <Card key={config.id} className={`border-slate-200 shadow-sm relative overflow-hidden group transition-all ${config.status === 'failing' ? 'ring-2 ring-rose-500 ring-offset-2' : ''}`}>
                      <div className={`absolute top-0 left-0 w-1 h-full ${
                        config.status === 'working' ? 'bg-emerald-500' : 
                        config.status === 'failing' ? 'bg-rose-500' : 
                        config.isActive ? 'bg-blue-500' : 'bg-slate-300'
                      }`}></div>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg font-bold">{config.name}</CardTitle>
                          <div className="flex gap-1">
                            {config.status === 'working' && <Badge className="bg-emerald-500 hover:bg-emerald-600">WORKING</Badge>}
                            {config.status === 'failing' && <Badge variant="destructive">FAILED</Badge>}
                            <Badge variant={config.isActive ? "default" : "secondary"}>{config.isActive ? "Active" : "Paused"}</Badge>
                          </div>
                        </div>
                        <CardDescription className="font-mono text-[10px]">{config.host}:{config.port}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            <span className="truncate">Auth: {config.user}</span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                            <div className="space-y-1">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sent</p>
                              <p className="text-sm font-bold text-emerald-600">{config.successCount || 0}</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Failed</p>
                              <p className="text-sm font-bold text-rose-600">{config.failCount || 0}</p>
                            </div>
                          </div>
                          
                          {config.lastResult && (
                            <div className="text-[9px] font-medium text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100 truncate">
                              LOG: {config.lastResult}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {smtpConfigs.length === 0 && (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-3xl">
                      <Server className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-medium">No delivery servers configured.<br/>Add your first SMTP to enable rotation.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "audience" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Manage Audience</h2>
                  <div className="flex gap-3">
                    <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
                      <DialogTrigger 
                        render={
                          <Button variant="outline" className="gap-2 border-slate-200 shadow-sm"><Upload className="w-4 h-4" /> Bulk Import</Button>
                        }
                      />
                      <DialogContent>
                        <DialogHeader><DialogTitle>Bulk Email Import</DialogTitle></DialogHeader>
                        <p className="text-xs text-slate-500 mb-2">Paste emails separated by commas or new lines.</p>
                        <textarea 
                          className="min-h-[200px] w-full rounded-xl border border-slate-200 p-4 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="alex@test.com, sarah@company.io, ..."
                          value={bulkEmails}
                          onChange={e => setBulkEmails(e.target.value)}
                        />
                        <DialogFooter>
                          <Button onClick={handleBulkImport} className="w-full bg-blue-600">Import Contacts</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button className="bg-slate-900 shadow-lg shadow-black/10">Add Contact</Button>
                  </div>
                </div>
                <Card className="border-slate-200/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Email Address</th>
                          <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Status</th>
                          <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Date Added</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {CONTACTS.slice(0, 10).map((contact, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-700">{contact.email}</td>
                            <td className="px-6 py-4">
                              <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 uppercase text-[9px] font-black">Subscribed</Badge>
                            </td>
                            <td className="px-6 py-4 text-slate-400 text-xs">Apr 22, 2026</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
            
            {activeTab === "campaigns" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {CAMPAIGNS.map((c) => (
                  <Card key={c.id} className="overflow-hidden border-slate-200/60 hover:shadow-lg transition-all group">
                    <div className={`h-1 ${c.status === 'sent' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                    <CardHeader>
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant={c.status === 'sent' ? 'default' : 'secondary'} className="text-[10px] font-black uppercase">
                          {c.status}
                        </Badge>
                        <span className="text-[10px] font-bold text-slate-400">{c.date}</span>
                      </div>
                      <CardTitle className="text-lg font-black group-hover:text-blue-600 transition-colors tracking-tight">{c.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Sent</p>
                          <p className="text-sm font-black">{c.sent.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Opens</p>
                          <p className="text-sm font-black text-emerald-600">{c.opens.toLocaleString()}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Clicks</p>
                          <p className="text-sm font-black text-blue-600">{c.clicks.toLocaleString()}</p>
                        </div>
                      </div>
                      <Button variant="outline" className="w-full text-xs font-bold border-slate-200 group-hover:bg-slate-900 group-hover:text-white transition-all">
                        VIEW DETAILED ANALYTICS
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
