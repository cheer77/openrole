const readPaths = /^(session|dashboard|jobs|companies|sources|discovery|logs|search|alerts|system|integrations|audit-logs)$/;
const mutationPaths = /^(login|logout|jobs\/bulk-delete|companies|sources|integrations\/(?:ga4|gtm|meta|clarity)|discovery\/[a-zA-Z0-9_-]+\/(?:approve|reject|retry|create-source|ignore)|(?:jobs|companies|sources)\/[a-zA-Z0-9_-]+(?:\/(?:status|reset|sync))?)$/;

export const allowedAdminReadPath = (path: string) => readPaths.test(path);
export const allowedAdminMutationPath = (path: string) => mutationPaths.test(path);
