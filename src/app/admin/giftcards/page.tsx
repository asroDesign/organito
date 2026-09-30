import {requirePage} from '@/lib/auth';
import {PageHeader} from '@/components/ui';
import {GiftCardsManager} from '@/components/CommerceClient';
export default async function Page(){await requirePage({perm:'PAYMENTS_MANAGE'});return <><PageHeader title="فروش کارت هدیه"/><GiftCardsManager/></>}
