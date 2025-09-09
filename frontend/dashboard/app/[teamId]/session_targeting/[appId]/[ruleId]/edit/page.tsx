import SessionTargetingPage from '@/app/components/session_targeting_page';

export default function EditSessionTargetingRule({ params }: { params: { teamId: string; appId: string; type: string; ruleId: string; ruleName: string } }) {
    return (
        <SessionTargetingPage 
            params={params}
            isEditMode={true}
        />
    );
}