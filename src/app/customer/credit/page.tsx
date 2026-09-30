import {requirePage} from '@/lib/auth';
import {PageHeader} from '@/components/ui';
import {CustomerCredit} from '@/components/CommerceClient';
export default async function Page(){await requirePage();return <><PageHeader title="اعتبار خرید"/><CustomerCredit/></>}
