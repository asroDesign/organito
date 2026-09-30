import {requirePage} from '@/lib/auth';
import {PageHeader} from '@/components/ui';
import {ReturnsManager} from '@/components/CommerceClient';
export default async function Page(){await requirePage({role:'seller'});return <><PageHeader title="درخواست‌های مرجوعی"/><ReturnsManager area="seller"/></>}
