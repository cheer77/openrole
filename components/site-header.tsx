'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './icon';
import { BrandLogo } from './brand-logo';

export function SiteHeader() {
	const pathname = usePathname();
	if (pathname.startsWith('/admin')) return null;
	return (
		<header className='site-header'>
			<div className='container header-inner'>
				<Link href='/' className='brand' aria-label='vmiyou home'>
					<BrandLogo eager />
				</Link>
				<nav aria-label='Main navigation'>
					<Link
						className={pathname.startsWith('/jobs') ? 'nav-active' : ''}
						href='/jobs'
						aria-current={pathname === '/jobs' ? 'page' : undefined}>
						Find Jobs
					</Link>
					<Link
						className={pathname === '/companies' ? 'nav-active' : ''}
						href='/companies'
						aria-current={pathname === '/companies' ? 'page' : undefined}>
						Companies
					</Link>
				</nav>
				<div className='header-actions' aria-label='Account tools'>
					<div className='header-shortcuts'>
						<button
							type='button'
							className='header-action'
							disabled
							aria-label='Favorite jobs — coming soon'
							title='Favorite jobs — coming soon'>
							<Icon name='star' size={21} />
						</button>
						<button
							type='button'
							className='header-action'
							disabled
							aria-label='Notifications — coming soon'
							title='Notifications — coming soon'>
							<Icon name='bell' size={21} />
						</button>
					</div>
					<Link className='header-account' href='/login' aria-label='Sign in'>
						<span className='header-avatar'>
							<Icon name='user' size={20} />
						</span>
						<span className='header-account-name'>Guest</span>
					</Link>
				</div>
			</div>
			<nav className='mobile-bottom-nav' aria-label='Mobile navigation'>
				<Link
					href='/jobs'
					className={pathname.startsWith('/jobs') ? 'mobile-nav-active' : ''}
					aria-current={pathname.startsWith('/jobs') ? 'page' : undefined}>
					<Icon name='search' size={22} />
					<span>Jobs</span>
				</Link>
				<Link
					href='/companies'
					className={pathname === '/companies' ? 'mobile-nav-active' : ''}
					aria-current={pathname === '/companies' ? 'page' : undefined}>
					<Icon name='briefcase' size={22} />
					<span>Companies</span>
				</Link>
				<button type='button' disabled title='Saved jobs — coming soon'>
					<Icon name='star' size={22} />
					<span>Saved</span>
				</button>
				<button type='button' disabled title='Notifications — coming soon'>
					<Icon name='bell' size={22} />
					<span>Alerts</span>
				</button>
				<Link href='/login' aria-label='Sign in'>
					<Icon name='user' size={22} />
					<span>Profile</span>
				</Link>
			</nav>
		</header>
	);
}
export function SiteFooter({ version }: { version: string }) {
	const pathname = usePathname();
	if (pathname.startsWith('/admin')) return null;
	return (
		<footer className='site-footer'>
			<div className='container footer-main'>
				<div className='footer-brand-column'>
					<Link href='/' className='brand footer-brand' aria-label='vmiyou home'>
						<BrandLogo />
					</Link>
					<p className='footer-tagline'>Jobs across every industry</p>
					<p className='footer-description'>
						Explore job opportunities directly from company career pages.
					</p>
					<div className='footer-socials' aria-label='Social networks coming soon'>
						<span className='footer-social-placeholder' role='img' aria-label='LinkedIn — coming soon' title='LinkedIn — coming soon'>
							<Icon name='linkedin' size={17} strokeWidth={1.8} />
						</span>
						<span className='footer-social-placeholder' role='img' aria-label='X — coming soon' title='X — coming soon'>
							<Icon name='xSocial' size={16} strokeWidth={1.8} />
						</span>
						<span className='footer-social-placeholder' role='img' aria-label='Instagram — coming soon' title='Instagram — coming soon'>
							<Icon name='instagram' size={17} strokeWidth={1.8} />
						</span>
						<span className='footer-social-placeholder' role='img' aria-label='YouTube — coming soon' title='YouTube — coming soon'>
							<Icon name='youtube' size={18} strokeWidth={1.8} />
						</span>
					</div>
				</div>
				<nav className='footer-navigation' aria-label='Footer navigation'>
					<div className='footer-nav-group'>
						<h2>Discover</h2>
						<Link href='/jobs'>Find Jobs</Link>
						<Link href='/companies'>Companies</Link>
						<Link href='/remote-jobs'>Remote Jobs</Link>
						<Link href='/jobs?experience=Junior'>Junior Roles</Link>
					</div>
					<div className='footer-nav-group'>
						<h2>Company</h2>
						<Link href='/privacy'>Privacy</Link>
					</div>
				</nav>
			</div>
			<div className='container footer-bottom'>
				<small>© 2026 Vmiyou. All rights reserved.</small>
				<small className='footer-version'>v{version}</small>
			</div>
		</footer>
	);
}
