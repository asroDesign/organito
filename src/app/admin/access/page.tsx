import { requirePage } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { RolesManager } from '@/components/UsersManager';
import { CrmClient } from '@/components/CrmClient';
import { PanelTabs } from '@/components/ui';
import { ShieldCheck,Users } from 'lucide-react';
export default async function Access({searchParams}:{searchParams:Promise<{tab?:string}>}){const sp=await searchParams;const groups=sp.tab==='groups';const me=await requirePage({perm:groups?'SMS_MANAGE':'USERS_MANAGE'});return <><PageHeader title="دسترسی و گروه‌های کاربران" subtitle="تعریف نقش‌های سفارشی و گروه‌بندی مشتریان برای کمپین‌ها"/><div className="mb-5"><PanelTabs items={[{href:'/admin/access',label:'نقش‌های کاربری',active:!groups,icon:ShieldCheck},{href:'/admin/access?tab=groups',label:'گروه‌های مشتریان',active:groups,icon:Users}]}/></div>{groups?<CrmClient mode="groups"/>:<RolesManager superAdmin={me.role==='super_admin'}/>}</>}
