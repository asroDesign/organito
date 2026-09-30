import {requirePage} from '@/lib/auth';
import {PageHeader} from '@/components/ui';
import {CrmClient} from '@/components/CrmClient';
export default async function Page(){await requirePage({perm:'SMS_MANAGE'});return <><PageHeader title="کمپین‌های تبلیغاتی"/><CrmClient area="admin" mode="campaigns"/></>}
