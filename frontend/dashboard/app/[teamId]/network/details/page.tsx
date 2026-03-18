import NetworkDetails from '@/app/components/network_details'

export default function ExploreUrl({ params }: { params: { teamId: string } }) {
    return <NetworkDetails params={params} />
}
