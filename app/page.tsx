import { requestTime } from '@/lib/api';
import type { Metadata } from 'next';
import Link from 'next/link';
import { connection } from 'next/server';
import { CompanyLogo } from '@/components/company-logo';
import { Icon } from '@/components/icon';
import { SearchBar } from '@/components/search-bar';
import { HorizontalScroller } from '@/components/horizontal-scroller';
import { getJobs, getCompanies, companyPresentation } from '@/lib/api';
import { workTypes, type Category } from '@/features/jobs/types';
import { JobCard } from '@/features/jobs/job-card';
import Image from 'next/image';

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
	'Software Engineering',
	'Sales',
	'Marketing',
	'Engineering',
	'Construction & Trades',
	'Manufacturing & Production',
	'Logistics & Supply Chain',
	'Healthcare',
	'Retail & Hospitality',
	'Finance & Accounting',
] as const satisfies readonly Category[];

export default async function Home() {
	await connection();
	const [listings, companyPage, remote] = await Promise.all([
		getJobs(new URLSearchParams({ limit: '4' })),
		getCompanies(new URLSearchParams({ limit: '8', sort: 'activeJobs' })),
		getJobs(new URLSearchParams({ limit: '1', remoteType: 'REMOTE' })),
	]);
	const now = requestTime();
	const featured = listings.items;
	const companies = companyPage.items.map((company) => ({
		...companyPresentation(company),
		activeJobs: company._count?.jobs ?? 0,
		tone: [...company.id].reduce((value, character) => value + character.charCodeAt(0), 0) % 2,
	}));
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

					<div className='hero-graphic'>
						<Image
							src='/graphic-hero.webp'
							alt='Hero graphic'
							width={800}
							height={600}
							sizes='(max-width: 900px) 1px, (max-width: 1150px) 311px, 380px'
							priority
						/>
					</div>

					{/* <Link className='home-hero-card' href='/jobs'>
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
					</Link> */}
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
					<HorizontalScroller
						className='home-featured-grid job-list-grid'
						label='Fresh opportunities'>
						{featured.map((job) => (
							<JobCard
								key={job.id}
								job={job}
								now={now}
								variant='grid'
								showDescription={false}
							/>
						))}
					</HorizontalScroller>
				</section>

				<section className='home-section' aria-labelledby='companies-heading'>
					<div className='home-section-heading'>
						<div>
							<span className='home-section-kicker'>The people behind the roles</span>
							<h2 id='companies-heading'>Companies hiring now</h2>
							<p className='home-section-subtitle'>Explore employers with active opportunities.</p>
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
					<HorizontalScroller className='home-company-grid' label='Companies hiring now'>
						{companies.map((company) => (
							<Link
								className='home-company-card'
								href={`/companies/${company.slug}`}
								key={company.slug}
								data-company-tone={company.tone}
								aria-label={`View jobs at ${company.name}`}>
								<CompanyLogo company={company} />
								<span className='home-company-copy'>
									<strong>{company.name}</strong>
									<span>{company.activeJobs} open jobs</span>
								</span>
								<Icon name='arrowUpRight' size={17} strokeWidth={1.8} />
							</Link>
						))}
					</HorizontalScroller>
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
							<div className='home-explore-title'>
								<span className='home-explore-icon'><Icon name='layers3' size={20} strokeWidth={1.8} /></span>
								<h3>By discipline</h3>
							</div>
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
							<div className='home-explore-title'>
								<span className='home-explore-icon'><Icon name='globe2' size={20} strokeWidth={1.8} /></span>
								<h3>By place and pace</h3>
							</div>
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
