'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { SearchBar } from '@/components/search-bar';
import { Select } from '@/components/select';
import { Icon } from '@/components/icon';
import { JobCard } from './job-card';
import { JobFilters } from './job-filters';
import {
	activeFilterCount,
	filterJobs,
	PAGE_SIZE,
	parseFilters,
	serializeFilters,
	sortOptions,
} from './filter-jobs';
import { type Filters, type Job } from './types';

const quickFilters: {
	label: string;
	patch: Partial<Filters>;
	field: keyof Filters;
	value: string;
}[] = [
	...[
		'Frontend',
		'Backend',
		'Full Stack',
		'QA',
		'DevOps',
		'Design',
		'Product',
		'Data',
		'AI / ML',
	].map((category) => ({
		label: category,
		patch: { category },
		field: 'category' as const,
		value: category,
	})),
];
export function JobsExplorer({ jobs, now }: { jobs: Job[]; now: number }) {
	const pathname = usePathname();
	const params = useSearchParams();
	const filters = parseFilters(params);
	const quickCategories = useRef<HTMLDivElement>(null);
	const quickScrollTrack = useRef<HTMLDivElement>(null);
	const quickScrollThumb = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		const list = quickCategories.current;
		const track = quickScrollTrack.current;
		const thumb = quickScrollThumb.current;
		if (!list || !track || !thumb) return;
		function syncScrollIndicator() {
			if (!list || !track || !thumb) return;
			const overflow = list.scrollWidth - list.clientWidth;
			track.hidden = overflow <= 1;
			const fraction = list.clientWidth / list.scrollWidth;
			thumb.style.width = `${fraction * 100}%`;
			const progress = overflow > 0 ? Math.max(0, Math.min(1, list.scrollLeft / overflow)) : 0;
			thumb.style.transform = `translateX(${((progress * (1 - fraction)) / fraction) * 100}%)`;
		}
		const observer = new ResizeObserver(syncScrollIndicator);
		observer.observe(list);
		for (const child of list.children) observer.observe(child);
		list.addEventListener('scroll', syncScrollIndicator, { passive: true });
		syncScrollIndicator();
		return () => {
			observer.disconnect();
			list.removeEventListener('scroll', syncScrollIndicator);
		};
	}, []);
	const dialog = useRef<HTMLDialogElement>(null);
	const filterTrigger = useRef<HTMLButtonElement>(null);
	const searchForm = useRef<HTMLFormElement>(null);
	const resultHeading = useRef<HTMLHeadingElement>(null);
	const [draft, setDraft] = useState(filters);
	const results = filterJobs(jobs, filters, now);
	const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
	const page = Math.min(filters.page, pages);
	const visible = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
	const count = activeFilterCount({ ...filters, location: '', workType: '' });
	const query = serializeFilters({ ...filters, page }).toString();
	function update(patch: Partial<Filters>) {
		const current = parseFilters(new URLSearchParams(window.location.search));
		const next = serializeFilters({
			...current,
			...patch,
			page: patch.page ?? 1,
		}).toString();
		if (next === window.location.search.slice(1)) return;
		// Next.js synchronizes native history with useSearchParams; local filtering needs no server request.
		window.history.pushState(null, '', `${pathname}${next ? `?${next}` : ''}`);
	}
	function reset() {
		searchForm.current?.reset();
		window.history.pushState(null, '', pathname);
	}
	function goToPage(next: number) {
		update({ page: next });
		resultHeading.current?.focus({ preventScroll: true });
		document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
	const activeChips: { label: string; patch: Partial<Filters> }[] = [
		...(filters.q ? [{ label: `“${filters.q}”`, patch: { q: '' } }] : []),
		...(['category', 'location', 'workType', 'experience', 'currency'] as const)
			.filter((key) => filters[key])
			.map((key) => ({
				label: filters[key],
				patch: {
					[key]: '',
					...(key === 'currency'
						? {
								salaryMin: '',
								salaryMax: '',
								sort: filters.sort.startsWith('salary') ? 'newest' : filters.sort,
							}
						: {}),
				},
			})),
		...(filters.posted
			? [
					{
						label: filters.posted === '1' ? 'Last 24 hours' : `Last ${filters.posted} days`,
						patch: { posted: '' },
					},
				]
			: []),
		...(filters.salaryMin
			? [
					{
						label: `From ${Number(filters.salaryMin).toLocaleString('en-US')}`,
						patch: { salaryMin: '' },
					},
				]
			: []),
		...(filters.salaryMax
			? [
					{
						label: `Up to ${Number(filters.salaryMax).toLocaleString('en-US')}`,
						patch: { salaryMax: '' },
					},
				]
			: []),
		...filters.tech.map((tech) => ({
			label: tech,
			patch: { tech: filters.tech.filter((value) => value !== tech) },
		})),
	];
	return (
		<>
			<section className='search-section' aria-label='Search jobs'>
				<div className='container search-inner'>
					<div className='search-heading'>
						<h1>Find your next job in your area</h1>
						<p>
							{jobs.length} opportunities. {new Set(jobs.map((job) => job.company.name)).size}{' '}
							companies. Your next move.
						</p>
					</div>
					<SearchBar
						formRef={searchForm}
						initialValues={{ q: filters.q, location: filters.location, workType: filters.workType }}
						onSubmit={(event) => {
							event.preventDefault();
							const data = new FormData(event.currentTarget);
							update({
								q: String(data.get('q') || '').trim(),
								location: String(data.get('location') || ''),
								workType: String(data.get('workType') || ''),
							});
						}}
					/>
				</div>
			</section>
			<div className='category-bar'>
				<div className='container quick-categories'>
					<div
						ref={quickCategories}
						className='quick-filters'
						role='group'
						aria-label='Quick categories'>
						{quickFilters.map((item) => (
							<button
								key={item.label}
								type='button'
								aria-pressed={filters[item.field] === item.value}
								className={filters[item.field] === item.value ? 'quick-chip active' : 'quick-chip'}
								onClick={() =>
									update(filters[item.field] === item.value ? { [item.field]: '' } : item.patch)
								}>
								{item.label}
							</button>
						))}
					</div>
					<div ref={quickScrollTrack} className='quick-scroll-track' aria-hidden='true' hidden>
						<span ref={quickScrollThumb} className='quick-scroll-thumb' />
					</div>
				</div>
			</div>
			<main id='main-content' className='container results-layout'>
				<aside className='desktop-filters' aria-label='Job filters'>
					<JobFilters filters={filters} onChange={update} />
					<div className='filter-note'>
						<Icon name='globe' size={19} />
						<p>
							<strong>Remote has a location, too.</strong> Check where each company can hire before
							you apply.
						</p>
					</div>
				</aside>
				<section className='results' id='results' aria-label='Job results'>
					<div className='results-toolbar'>
						<div>
							<h2 ref={resultHeading} tabIndex={-1} aria-live='polite'>
								{results.length} <span>{results.length === 1 ? 'job' : 'jobs'} found</span>
							</h2>
						</div>
						<label className='sort-control'>
							<span className='sort-label' aria-hidden='true'>
								Sort by
							</span>
							<span className='sr-only'>Sort jobs</span>
							<Select
								aria-label='Sort jobs'
								value={filters.sort}
								onChange={(value) =>
									update({
										sort: value,
										...(value.startsWith('salary') && !filters.currency ? { currency: 'USD' } : {}),
									})
								}>
								{sortOptions.map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</Select>
							<Icon name='down' size={14} />
						</label>
					</div>
					<div className='results-subline'>
						<p aria-live='polite' role='status'>
							{filters.q ? `Results for “${filters.q}”` : 'Tech & digital careers, in one place'}
						</p>
						<span className='demo-label'>
							<span className='tiny-dot' />
							Demo listings
						</span>
					</div>
					<button
						ref={filterTrigger}
						type='button'
						className='mobile-filter-button'
						onClick={() => {
							setDraft(filters);
							dialog.current?.showModal();
						}}>
						<Icon name='filters' size={17} />
						Filters{count > 0 && <span>{count}</span>}
						<Icon name='down' size={15} />
					</button>
					{activeChips.length > 0 && (
						<div className='active-filters'>
							{activeChips.map((chip, index) => (
								<button
									type='button'
									key={`${chip.label}-${index}`}
									onClick={() => update(chip.patch)}
									aria-label={`Remove ${chip.label} filter`}>
									{chip.label}
									<Icon name='close' size={12} />
								</button>
							))}
							<button type='button' className='clear-filters' onClick={reset}>
								Clear all
							</button>
						</div>
					)}
					{filters.sort.startsWith('salary') && (
						<p className='sort-note'>
							Showing published salaries in {filters.currency}. All amounts are per year.
						</p>
					)}
					<div className='job-list'>
						{visible.map((job) => (
							<JobCard key={job.id} job={job} now={now} returnQuery={query} />
						))}
					</div>
					{results.length === 0 && (
						<div className='empty-state'>
							<span>
								<Icon name='search' size={28} />
							</span>
							<h3>A fresh search might open a door.</h3>
							<p>No roles match this combination yet. Try a broader keyword or remove a filter.</p>
							<button className='primary-button' type='button' onClick={reset}>
								Explore all jobs <Icon name='arrow' size={17} />
							</button>
						</div>
					)}
					{results.length > 0 && (
						<div className='pagination'>
							<p>
								Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, results.length)} of{' '}
								{results.length} jobs
							</p>
							{pages > 1 && (
								<nav aria-label='Pagination'>
									<button
										type='button'
										aria-label='Previous page'
										disabled={page === 1}
										onClick={() => goToPage(page - 1)}>
										<Icon name='chevron' style={{ transform: 'rotate(180deg)' }} size={15} />
									</button>
									{Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
										<button
											type='button'
											key={number}
											aria-label={`Page ${number}`}
											aria-current={number === page ? 'page' : undefined}
											className={number === page ? 'current' : ''}
											onClick={() => goToPage(number)}>
											{number}
										</button>
									))}
									<button
										type='button'
										aria-label='Next page'
										disabled={page === pages}
										onClick={() => goToPage(page + 1)}>
										<Icon name='chevron' size={15} />
									</button>
								</nav>
							)}
						</div>
					)}
					<div className='demo-notice'>
						<Icon name='sparkle' size={17} />
						<p>
							You’re exploring a prototype. Jobs and salaries are illustrative; company links lead
							to careers pages.
						</p>
					</div>
				</section>
			</main>
			<dialog
				ref={dialog}
				className='filter-dialog'
				aria-labelledby='filter-dialog-title'
				onClose={() => filterTrigger.current?.focus({ preventScroll: true })}
				onClick={(event) => {
					if (event.target === event.currentTarget) dialog.current?.close();
				}}>
				<div className='dialog-top'>
					<h2 id='filter-dialog-title'>Filter jobs</h2>
					<button
						type='button'
						className='icon-button'
						aria-label='Close filters'
						onClick={() => dialog.current?.close()}>
						<Icon name='close' />
					</button>
				</div>
				<div className='dialog-body'>
					<JobFilters
						filters={draft}
						onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
						onReset={() => {
							setDraft(parseFilters(new URLSearchParams()));
							reset();
						}}
					/>
				</div>
				<div className='dialog-bottom'>
					<button
						type='button'
						className='primary-button'
						onClick={() => {
							update({ ...draft, page: 1 });
							dialog.current?.close();
						}}>
						Show {filterJobs(jobs, draft, now).length} jobs <Icon name='arrow' size={18} />
					</button>
				</div>
			</dialog>
		</>
	);
}
