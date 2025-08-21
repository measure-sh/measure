import SessionTargetingRule from '@/app/components/session_targeting/session_targeting_rule';

export default function EditSessionTargetingRule({ params }: { params: { teamId: string; appId: string; type: string; ruleId: string; ruleName: string } }) {
    return (
        <SessionTargetingRule 
            params={params}
            isEditMode={true}
        />
    );
}