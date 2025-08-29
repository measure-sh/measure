import SamplingRulePage from '@/app/components/sampling_rule_page';

export default function EditSamplingRule({ params }: { params: { teamId: string; appId: string; type: string; ruleId: string; ruleName: string } }) {
    return (
        <SamplingRulePage 
            params={params}
            isEditMode={true}
        />
    );
}