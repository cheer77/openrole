import { requestTime } from '@/lib/api';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { CompanyLogo } from '@/components/company-logo';
import { Icon } from '@/components/icon';
import { SearchBar } from '@/components/search-bar';
import { getJobs, getCompanies, companyPresentation } from '@/lib/api';
import { workTypes, type Category } from '@/features/jobs/types';
import { formatSalary, locationLabel, timeAgo } from '@/lib/format';

export const metadata: Metadata = {
	title: 'Discover your next role',
	alternates: { canonical: '/' },
	description: 'Explore jobs across industries, companies, and flexible ways to work on vmiyou.',
};

const quickSearches = [
	{ label: 'All jobs', href: '/jobs' },
	{ label: 'Remote', href: '/jobs?workType=Remote' },
	{ label: 'Junior roles', href: '/jobs?experience=Junior' },
	{ label: 'Frontend', href: '/jobs?category=Frontend' },
	{ label: 'Design', href: '/jobs?category=Design' },
	{ label: 'Sales', href: '/jobs?category=Sales' },
];
const regions = ['Worldwide', 'Europe', 'Spain', 'UK', 'USA'] as const;
const homeCategories = [
	'Software Engineering', 'Sales', 'Marketing', 'Engineering',
	'Construction & Trades', 'Manufacturing & Production',
	'Logistics & Supply Chain', 'Healthcare', 'Retail & Hospitality', 'Finance & Accounting',
] as const satisfies readonly Category[];

export default async function Home() {
	await connection();
	const [listings, companyPage, remote] = await Promise.all([
		getJobs(new URLSearchParams({ limit: '4' })),
		getCompanies(new URLSearchParams({ limit: '8' })),
		getJobs(new URLSearchParams({ limit: '1', remoteType: 'REMOTE' })),
	]);
	const now = requestTime();
	const featured = listings.items;
	const companies = companyPage.items.map(companyPresentation);
	const remoteCount = remote.total;

	return (
		<main id='main-content' className='home-page'>
			<section className='home-hero' aria-labelledby='home-title'>
				<div className='container home-hero-inner'>
					<div className='home-hero-copy'>
						<span className='home-eyebrow'>
							<span aria-hidden='true' /> Jobs across every industry
						</span>
						<h1 id='home-title'>All jobs. One search.</h1>
						<p>
							Explore thousands of jobs across industries, companies and locations - all in one
							place.
						</p>
						<div className='home-hero-facts' aria-label='Current collection size'>
							<span>
								<strong>{listings.total}</strong> open roles
							</span>
							<span>
								<strong>{companyPage.total}</strong> companies
							</span>
							<span>
								<strong>{remoteCount}</strong> remote roles
							</span>
						</div>
					</div>
					<Link className='home-hero-card' href='/jobs'>
						<div className='home-hero-card-top'>
							<span className='home-hero-orbit'>
								<Icon name='sparkle' size={22} />
							</span>
							<span>vmiyou / your next chapter</span>
						</div>
						<p>Good work starts with a clearer search.</p>
						<div className='home-hero-card-bottom'>
							<span>Explore roles</span>
							<Icon name='arrow' size={19} />
						</div>
					</Link>
					<SearchBar action='/jobs' inputType='search' />
					<nav className='home-quick-links' aria-label='Popular searches'>
						{quickSearches.map((item) => (
							<Link href={item.href} key={item.label}>
								{item.label}
							</Link>
						))}
					</nav>
				</div>
			</section>

			<div className='container home-content'>
				<section className='home-section' aria-labelledby='featured-heading'>
					<div className='home-section-heading'>
						<div>
							<span className='home-section-kicker'>A place to start</span>
							<h2 id='featured-heading'>Fresh opportunities</h2>
						</div>
						<Link className='home-section-link' href='/jobs'>
							See all jobs <Icon name='arrow' size={17} />
						</Link>
					</div>
					{featured.length === 0 && (
						<p className='empty-state'>No open roles yet. Please check back soon.</p>
					)}
					<div className='home-featured-grid'>
						{featured.map((job) => (
							<article className='home-job-card' key={job.id}>
								<div className='home-job-card-top'>
									<CompanyLogo company={job.company} />
									<span className='home-job-fresh'>
										{!job.publishedAt && 'Added '}
										{timeAgo(job.publishedAt || job.firstSeenAt, now)}
									</span>
								</div>
								<h3>
									<Link href={`/jobs/${job.slug}`}>{job.title}</Link>
								</h3>
								<p className='home-job-company'>{job.company.name}</p>
								<p className='home-job-pay'>{formatSalary(job.salary)}</p>
								<div className='home-job-card-bottom'>
									<span>
										{job.workType} · {locationLabel(job)}
									</span>
									<Link
										href={`/jobs/${job.slug}`}
										aria-label={`View ${job.title} at ${job.company.name}`}>
										<Icon name='arrow' size={17} />
									</Link>
								</div>
							</article>
						))}
					</div>
				</section>

				<section className='home-section' aria-labelledby='companies-heading'>
					<div className='home-section-heading'>
						<div>
							<span className='home-section-kicker'>The people behind the roles</span>
							<h2 id='companies-heading'>Explore companies</h2>
						</div>
						<Link className='home-section-link' href='/companies'>
							All companies <Icon name='arrow' size={17} />
						</Link>
					</div>
					{companies.length === 0 && (
						<p className='empty-state'>
							Companies will appear here when their career boards are connected.
						</p>
					)}
					<div className='home-company-grid'>
						{companies.slice(0, 8).map((company) => (
							<Link
								className='home-company-card'
								href={`/companies/${company.slug}`}
								key={company.name}
								aria-label={`View jobs at ${company.name}`}>
								<CompanyLogo company={company} />
								<span>{company.name}</span>
							</Link>
						))}
					</div>
				</section>

				<section className='home-section home-explore' aria-labelledby='explore-heading'>
					<div className='home-section-heading'>
						<div>
							<span className='home-section-kicker'>Make the search yours</span>
							<h2 id='explore-heading'>Explore your way</h2>
						</div>
					</div>
					<div className='home-explore-grid'>
						<div className='home-explore-panel'>
							<h3>By discipline</h3>
							<p>Find roles shaped around your strengths.</p>
							<div className='home-explore-chips'>
								{homeCategories.map((category) => (
									<Link href={`/jobs?category=${encodeURIComponent(category)}`} key={category}>
										{category}
									</Link>
								))}
							</div>
						</div>
						<div className='home-explore-panel'>
							<h3>By place and pace</h3>
							<p>Choose where and how you want to work.</p>
							<div className='home-explore-chips'>
								{workTypes.map((type) => (
									<Link href={`/jobs?workType=${encodeURIComponent(type)}`} key={type}>
										{type}
									</Link>
								))}
								{regions.map((region) => (
									<Link href={`/jobs?location=${encodeURIComponent(region)}`} key={region}>
										{region}
									</Link>
								))}
							</div>
						</div>
					</div>
				</section>
				<p className='home-demo-note'>
					Explore listings from company career pages. Availability and hiring requirements are
					confirmed by the employer.
				</p>
			</div>
		</main>
	);
}
