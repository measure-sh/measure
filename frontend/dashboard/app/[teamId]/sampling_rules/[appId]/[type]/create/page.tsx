import SamplingRulePage from '@/app/components/sampling_rule_page';

export default function CreateSamplingRule({ params }: { params: { teamId: string; appId: string; type: string } }) {
    return (
        <SamplingRulePage 
            params={params}
            isEditMode={false}
        />
    );
}