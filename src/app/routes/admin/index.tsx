import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
    component: AdminHomePage,
})

function AdminHomePage() {
    return <h1>Dashboard Admin</h1>
}