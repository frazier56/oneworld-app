import { useParams } from 'react-router-dom';
import { ThreadScreen } from '@oneworld/shell';
import RentalRequests from '../components/RentalRequests';
export default function RentalThread() {
  const { id } = useParams();
  return <ThreadScreen product="onerental" contextSlot={id ? <RentalRequests conversationId={id} /> : undefined} />;
}
