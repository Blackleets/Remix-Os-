import { useEffect, useState } from 'react';
import { Card, Button, Input, Label, cn } from '../components/Common';
import { Plus, UserPlus, Mail, Shield, MoreVertical, Trash2, ShieldCheck, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../hooks/useLocale';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { UpgradeModal } from '../components/UpgradeModal';
import { PLANS, isLimitReached, getCompanyUsage } from '../lib/plans';

interface Member {
  id: string; // membership id
  userId: string;
  role: 'owner' | 'admin' | 'staff' | 'viewer';
  email: string;
  displayName?: string;
  photoURL?: string;
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
  const { t } = useLocale();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'staff' as any });

  const handleOpenInvite = async () => {
    if (!company) return;
    const planId = company.subscription?.planId || 'starter';
    const plan = PLANS[planId];
    try {
      const usage = await getCompanyUsage(company.id);
      if (isLimitReached(usage.seats, plan.limits.seats)) {
        setIsUpgradeModalOpen(true);
        return;
      }
    } catch (e) {
      console.warn('Plan usage check failed, falling back to local count', e);
      const totalSeats = members.length + invitations.filter(i => i.status === 'pending').length;
      if (isLimitReached(totalSeats, plan.limits.seats)) {
        setIsUpgradeModalOpen(true);
        return;
      }
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
      const userData = userDoc.exists() ? userDoc.data() : { email: t('team.unnamed_node') };
      
      memberList.push({
        id: membershipDoc.id,
        userId: mData.userId,
        role: mData.role,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
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
        title: t('team.activity.invite_title'),
        subtitle: t('team.activity.invite_subtitle', { email: inviteForm.email, role: inviteForm.role }),
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
    if (!confirm(t('team.alerts.change_role', { role: newRole }))) return;
    
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
        alert(t('team.alerts.owner_termination'));
        return;
      }
    }
    
    if (!confirm(t('team.alerts.remove_member', { email: member.email }))) return;

    try {
      await deleteDoc(doc(db, 'memberships', member.id));
      
      // Log Activity
      await addDoc(collection(db, 'activities'), {
        type: 'team_remove',
        title: t('team.activity.remove_title'),
        subtitle: t('team.activity.remove_subtitle', { email: member.email }),
        companyId: company?.id,
        createdAt: serverTimestamp(),
      });

      fetchTeam();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm(t('team.alerts.revoke_invite'))) return;
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
          <h1 className="font-display text-4xl font-bold tracking-tight mb-2 text-white">{t('team.title')}</h1>
          <p className="text-neutral-500 text-sm">{t('team.subtitle')}</p>
        </div>
        {canManage && (
          <Button onClick={handleOpenInvite} className="gap-2 px-6">
            <UserPlus className="w-4 h-4" /> {t('team.recruit')}
          </Button>
        )}
      </div>

      <UpgradeModal 
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        title={t('team.upgrade.title')}
        message={t('team.upgrade.message')}
        limitName={t('team.upgrade.limit_name')}
      />

      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <Card className="relative overflow-hidden group border-white/5 bg-neutral-900/40 p-0">
            <div className="p-6 border-b border-white/[0.05] bg-white/[0.01]">
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">{t('team.active_command')}</h3>
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="table-header">{t('team.table.identity')}</th>
                    <th className="table-header">{t('team.table.designation')}</th>
                    {canManage && <th className="table-header text-right">{t('team.table.auth')}</th>}
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
                          <div className="w-9 h-9 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs uppercase overflow-hidden">
                            {member.photoURL ? (
                              <img src={member.photoURL} alt={member.displayName || member.email} className="w-full h-full object-cover" />
                            ) : (
                              member.displayName ? member.displayName[0] : member.email[0]
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-neutral-200">{member.displayName || t('team.unnamed_node')}</span>
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
                            {t(`team.roles.${member.role}`)}
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
                                  <option value="admin">{t('team.roles.admin')}</option>
                                  <option value="staff">{t('team.roles.staff')}</option>
                                  <option value="viewer">{t('team.roles.viewer')}</option>
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
                            <span className="text-[10px] text-amber-500/50 uppercase font-bold tracking-tighter">{t('team.immortal')}</span>
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
                      <div className="w-9 h-9 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-xs shrink-0 overflow-hidden">
                        {member.photoURL ? (
                          <img src={member.photoURL} alt={member.displayName || member.email} className="w-full h-full object-cover" />
                        ) : (
                          member.displayName ? member.displayName[0] : member.email[0]
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-neutral-200 truncate">{member.displayName || t('team.unnamed_node')}</p>
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
                        {t(`team.roles.${member.role}`)}
                      </span>
                    </div>
                    {canManage && member.role !== 'owner' && (
                      <select 
                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-[9px] font-bold text-neutral-400 uppercase tracking-widest outline-none"
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                      >
                        <option value="admin">{t('team.roles.admin')}</option>
                        <option value="staff">{t('team.roles.staff')}</option>
                        <option value="viewer">{t('team.roles.viewer')}</option>
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
              <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">{t('team.transmissions')}</h3>
              <Clock className="w-4 h-4 text-neutral-600" />
            </div>
            <div className="space-y-4">
              {invitations.filter(inv => inv.status === 'pending').map((invite) => (
                <div key={invite.id} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold text-white leading-none">{invite.email}</p>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-tighter font-mono">{t(`team.roles.${invite.role}`)} {t('team.table.designation').toLowerCase()}</p>
                    </div>
                    {canManage && (
                      <Button variant="ghost" className="w-7 h-7 p-0 text-red-500/50 hover:text-red-500" onClick={() => handleRevokeInvite(invite.id)}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">{t('team.awaiting_uplink')}</span>
                  </div>
                </div>
              ))}
              {invitations.filter(inv => inv.status === 'pending').length === 0 && (
                <div className="py-10 text-center space-y-2">
                  <Mail className="w-8 h-8 text-neutral-800 mx-auto" />
                  <p className="text-[10px] text-neutral-600 uppercase tracking-widest font-bold">{t('team.no_pings')}</p>
                </div>
              )}
            </div>
          </Card>

          <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-2">
             <div className="flex items-center gap-2 text-blue-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{t('team.integrity_title')}</span>
             </div>
             <p className="text-[11px] text-neutral-400 leading-relaxed italic">
               {t('team.integrity_desc')}
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
                  {t('team.modal.title')}
                </h2>
                <button onClick={() => setIsInviteModalOpen(false)} className="p-2 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-white/5">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleInvite} className="p-8 space-y-6">
                <div>
                  <Label>{t('team.modal.email')}</Label>
                  <Input 
                    required 
                    type="email"
                    value={inviteForm.email} 
                    onChange={e => setInviteForm({...inviteForm, email: e.target.value})} 
                    placeholder={t('team.modal.email_placeholder')}
                  />
                </div>
                <div>
                  <Label>{t('team.modal.role')}</Label>
                  <select 
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all appearance-none outline-none"
                    value={inviteForm.role}
                    onChange={e => setInviteForm({...inviteForm, role: e.target.value as any})}
                  >
                    <option value="admin">{t('team.modal.admin_desc')}</option>
                    <option value="staff">{t('team.modal.staff_desc')}</option>
                    <option value="viewer">{t('team.modal.viewer_desc')}</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-6">
                  <Button type="button" variant="secondary" onClick={() => setIsInviteModalOpen(false)} className="px-6">{t('team.modal.abort')}</Button>
                  <Button type="submit" disabled={loading} className="px-8 flex gap-2">
                    {loading ? t('settings.syncing_msg') : (
                      <>
                        <Mail className="w-4 h-4" /> {t('team.modal.send')}
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
