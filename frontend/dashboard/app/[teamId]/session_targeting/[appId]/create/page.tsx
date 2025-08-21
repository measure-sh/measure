import SessionTargetingRule from '@/app/components/session_targeting/session_targeting_rule';

export default function CreateSessionTargetingRule({ params }: { params: { teamId: string; appId: string; type: string } }) {
    return (
        <SessionTargetingRule 
            params={params}
            isEditMode={false}
        />
    );
}