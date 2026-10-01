import {requirePage} from '@/lib/auth';
import {redirect} from 'next/navigation';
export default async function Page(){await requirePage();redirect('/customer/wallet')}
