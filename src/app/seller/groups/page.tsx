import {requirePage} from '@/lib/auth';
import {PageHeader} from '@/components/ui';
import {CrmClient} from '@/components/CrmClient';
export default async function Page(){await requirePage({role:'seller'});return <><PageHeader title="گروه‌های مشتریان"/><CrmClient area="seller" mode="groups"/></>}
