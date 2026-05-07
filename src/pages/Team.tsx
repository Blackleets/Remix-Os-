import { useEffect, useState } from 'react';
import { Card, Button, Input, Label, cn } from '../components/Common';
import { Plus, UserPlus, Mail, Shield, MoreVertical, Trash2, ShieldCheck, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { UpgradeModal } from '../components/UpgradeModal';
import { PLANS, isLimitReached } from '../lib/plans';

interface Member {
  id: string; // membership id
  userId: string;
  role: 'owner' | 'admin' | 'staff' | 'viewer';
  email: string;
  displayName?: string;
  joinedAt: any;
}

interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'staff' | 'viewer';
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  createdAt: any;
}

export function Team() {
  const { company, role: myRole } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'staff' as any });

  const handleOpenInvite = () => {
    const planId = company?.subscription?.planId || 'starter';
    const plan = PLANS[planId];
    const totalSeats = members.length + invitations.filter(i => i.status === 'pending').length;
    
    if (isLimitReached(totalSeats, plan.limits.seats)) {
      setIsUpgradeModalOpen(true);
      return;
    }
    setIsInviteModalOpen(true);
  };

  const fetchTeam = async () => {
    if (!company) return;
    
    // Fetch Memberships
    const membershipsQ = query(collection(db, 'memberships'), where('companyId', '==', company.id));
    const membershipsSnap = await getDocs(membershipsQ);
    
    const memberList: Member[] = [];
    for (const membershipDoc of membershipsSnap.docs) {
      const mData = membershipDoc.data();
      // Fetch User profile for each member
      const userDoc = await getDoc(doc(db, 'users', mData.userId));
      const userData = userDoc.exists() ? userDoc.data() : { email: 'Unknown User' };
      
      memberList.push({
        id: membershipDoc.id,
        userId: mData.userId,
        role: mData.role,
        email: userData.email,
        displayName: userData.displayName,
        joinedAt: mData.createdAt,
      });
    }
    setMembers(memberList);

    // Fetch Invitations
    const invitesQ = query(collection(db, 'invitations'), where('companyId', '==', company.id));
    const invitesSnap = await getDocs(invitesQ);
    setInvitations(invitesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation)));
  };

  useEffect(() => {
    fetchTeam();
  }, [company]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !inviteForm.email) return;

    setLoading(true);
    try {
      const inviteId = `${inviteForm.email.toLowerCase()}_${company.id}`;
      await setDoc(doc(db, 'invitations', inviteId), {
        email: inviteForm.email.toLowerCase(),
        role: inviteForm.role,
        companyId: company.id,
        companyName: company.name,
        status: 'pending',
        invitedBy: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
      });

      // Log Activity
      await addDoc(collection(db, 'activities'), {
        type: 'team_invite',
        title: 'Team Invitation',
        subtitle: `Invited ${inviteForm.email} as ${inviteForm.role}`,
        companyId: company.id,
        createdAt: serverTimestamp(),
      });

      setIsInviteModalOpen(false);
      setInviteForm({ email: '', role: 'staff' });
      fetchTeam();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!confirm(`Are you sure you want to change this member's role to ${newRole}?`)) return;
    
    try {
      await updateDoc(doc(db, 'memberships', memberId), {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
      fetchTeam();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (member: Member) => {
    if (member.role === 'owner') {
      const owners = members.filter(m => m.role === 'owner');
      if (owners.length <= 1) {
        alert("The command structure requires at least one immortal (owner). Transfer ownership or promote another before termination.");
        return;
      }
    }
    
    if (!confirm(`Are you sure you want to remove ${member.email} from the team?`)) return;

    try {
      await deleteDoc(doc(db, 'memberships', member.id));
      
      // Log Activity
      await addDoc(collection(db, 'activities'), {
        type: 'team_remove',
        title: 'Member Removed',
        subtitle: `${member.email} was removed from the team`,
        companyId: company?.id,
        createdAt: serverTimestamp(),
      });

      fetchTeam();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm("Revoke this invitation?")) return;
    try {
      await updateDoc(doc(db, 'invitations', inviteId), {
        status: 'revoked',
        updatedAt: serverTimestamp(),
      });
      fetchTeam();
    } catch (err) {
      console.error(err);
    }
  };

  const canManage = myRole === 'owner' || myRole === 'admin';

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">Personnel Protocol</h1>
          <p className="text-neutral-500 text-sm">Manage multi-user access and role-based operational permissions.</p>
        </div>
        {canManage && (
          <Button onClick={handleOpenInvite} className="gap-2 px-6">
            <UserPlus className="w-4 h-4" /> Recruit Member
          </Button>
        )}
      </div>

      <UpgradeModal 
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title="Admin Seat Exhausted"
        message="Your operational hierarchy has reached its maximum designated seat count. Upgrade to expand your command structure."
        limitName="Team Seats"
      />

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <Card className="relative overflow-hidden group border-white/5 bg-neutral-900/40 p-0">
            <div className="p-6 border-b border-white/[0.05] bg-white/[0.01]">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Active Command</h3>
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="table-header">Identity</th>
                    <th className="table-header">Designation</th>
                    {canManage && <th className="table-header text-right">Auth</th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, i) => (
                    <motion.tr 
                      key={member.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="group hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs uppercase">
                            {member.displayName ? member.displayName[0] : member.email[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-neutral-200">{member.displayName || 'Unnamed node'}</span>
                            <span className="text-[10px] text-neutral-500">{member.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <Shield className={cn(
                            "w-3 h-3",
                            member.role === 'owner' ? "text-amber-500" :
                            member.role === 'admin' ? "text-blue-500" :
                            "text-neutral-500"
                          )} />
                          <span className="text-xs uppercase font-bold tracking-widest text-neutral-300">
                            {member.role}
                          </span>
                        </div>
                      </td>
                      {canManage && (
                        <td className="table-cell text-right">
                          {member.role !== 'owner' && (
                             <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                <select 
                                  className="bg-black border border-white/10 rounded-lg text-[10px] px-2 py-1 outline-none text-neutral-400 focus:border-blue-500 transition-colors mr-2"
                                  value={member.role}
                                  onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                                >
                                  <option value="admin">Admin</option>
                                  <option value="staff">Staff</option>
                                  <option value="viewer">Viewer</option>
                                </select>
                                <Button 
                                  variant="ghost" 
                                  className="w-8 h-8 p-0 text-red-400 hover:bg-red-400/5"
                                  onClick={() => handleRemoveMember(member)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                             </div>
                          )}
                          {member.role === 'owner' && (
                            <span className="text-[10px] text-amber-500/50 uppercase font-bold tracking-tighter">Immortal</span>
                          )}
                        </td>
                      )}
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="sm:hidden divide-y divide-white/[0.05]">
              {members.map((member, i) => (
                <div key={member.id} className="p-4 space-y-3 active:bg-white/[0.02]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs shrink-0">
                        {member.displayName ? member.displayName[0] : member.email[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-neutral-200 truncate">{member.displayName || 'No Name'}</p>
                        <p className="text-[10px] text-neutral-500 truncate">{member.email}</p>
                      </div>
                    </div>
                    {canManage && member.role !== 'owner' && (
                      <div className="shrink-0">
                        <Button 
                          variant="ghost" 
                          className="w-8 h-8 p-0 text-red-400"
                          onClick={() => handleRemoveMember(member)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className={cn(
                        "w-3 h-3",
                        member.role === 'owner' ? "text-amber-500" :
                        member.role === 'admin' ? "text-blue-500" :
                        "text-neutral-500"
                      )} />
                      <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">
                        {member.role}
                      </span>
                    </div>
                    {canManage && member.role !== 'owner' && (
                      <select 
                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[9px] font-bold text-neutral-400 uppercase tracking-widest outline-none"
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                      >
                        <option value="admin">Admin</option>
                        <option value="staff">Staff</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-white/5 bg-neutral-900/40 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">Transmissions</h3>
              <Clock className="w-4 h-4 text-neutral-600" />
            </div>
            <div className="space-y-4">
              {invitations.filter(inv => inv.status === 'pending').map((invite) => (
                <div key={invite.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold text-white leading-none">{invite.email}</p>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-tighter font-mono">{invite.role} designation</p>
                    </div>
                    {canManage && (
                      <Button variant="ghost" className="w-7 h-7 p-0 text-red-500/50 hover:text-red-500" onClick={() => handleRevokeInvite(invite.id)}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Awaiting Uplink</span>
                  </div>
                </div>
              ))}
              {invitations.filter(inv => inv.status === 'pending').length === 0 && (
                <div className="py-10 text-center space-y-2">
                  <Mail className="w-8 h-8 text-neutral-800 mx-auto" />
                  <p className="text-[10px] text-neutral-600 uppercase tracking-widest font-bold">No active pings</p>
                </div>
              )}
            </div>
          </Card>

          <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-2">
             <div className="flex items-center gap-2 text-blue-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Protocol Integrity</span>
             </div>
             <p className="text-[11px] text-neutral-400 leading-relaxed italic">
               Permissions are enforced at the edge. Actions will be validated against your hierarchy designation.
             </p>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isInviteModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-neutral-900 w-full max-w-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden shadow-black"
            >
              <div className="p-8 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
                <h2 className="font-display text-xl font-bold text-white uppercase tracking-tight">
                  Recruitment Signal
                </h2>
                <button onClick={() => setIsInviteModalOpen(false)} className="p-2 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-white/5">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleInvite} className="p-8 space-y-6">
                <div>
                  <Label>Candidate Communication Channel</Label>
                  <Input 
                    required 
                    type="email"
                    value={inviteForm.email} 
                    onChange={e => setInviteForm({...inviteForm, email: e.target.value})} 
                    placeholder="entity@network.com"
                  />
                </div>
                <div>
                  <Label>Designated Role</Label>
                  <select 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none outline-none"
                    value={inviteForm.role}
                    onChange={e => setInviteForm({...inviteForm, role: e.target.value as any})}
                  >
                    <option value="admin">Admin (Full Control)</option>
                    <option value="staff">Staff (Operational)</option>
                    <option value="viewer">Viewer (Read-only)</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-6">
                  <Button type="button" variant="secondary" onClick={() => setIsInviteModalOpen(false)} className="px-6">Abort</Button>
                  <Button type="submit" disabled={loading} className="px-8 flex gap-2">
                    {loading ? 'Initializing...' : (
                      <>
                        <Mail className="w-4 h-4" /> Send Invitation
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
