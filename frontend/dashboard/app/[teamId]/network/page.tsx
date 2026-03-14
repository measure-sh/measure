import NetworkOverview from '@/app/components/network_overview'

export default function NetworkPage({ params }: { params: { teamId: string } }) {
    return <NetworkOverview params={params} />
}
