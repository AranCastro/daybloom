import { Redirect } from 'expo-router';

import { useAppState } from '@/lib/store';

export default function Gate() {
  const onboarded = useAppState((s) => s.onboarded);
  return <Redirect href={onboarded ? '/today' : '/onboarding'} />;
}
