import { fetchAllCameras } from '@/lib/aggregator';
import Dashboard from './Dashboard';

export const revalidate = 300;

export default async function Page() {
  const { cameras, errors } = await fetchAllCameras();
  return <Dashboard cameras={cameras} errors={errors} />;
}
