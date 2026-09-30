import { requirePage } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { UsersManager } from '@/components/UsersManager';
export default async function UsersPage(){const me=await requirePage({perm:'USERS_MANAGE'});return <><PageHeader title="کاربران" subtitle="اطلاعات حساب، خریدها، اعتبار و دسترسی‌های کاربران"/><UsersManager selfId={me.id} superAdmin={me.role==='super_admin'}/></>}
