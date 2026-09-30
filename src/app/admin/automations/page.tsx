import {requirePage} from '@/lib/auth';
import {PageHeader} from '@/components/ui';
import {CrmClient} from '@/components/CrmClient';
export default async function Page(){await requirePage({perm:'SMS_MANAGE'});return <><PageHeader title="رویدادهای خودکار"/><CrmClient area="admin" mode="automations"/></>}
