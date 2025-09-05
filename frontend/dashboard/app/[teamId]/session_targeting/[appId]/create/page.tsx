import SessionTargetingPage from '@/app/components/session_targeting_page';

export default function CreateSessionTargetingRule({ params }: { params: { teamId: string; appId: string; type: string } }) {
    return (
        <SessionTargetingPage 
            params={params}
            isEditMode={false}
        />
    );
}