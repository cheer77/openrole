import Image from 'next/image';
import brandLogo from '@/public/logo/logo-vmiyou.webp';

export function BrandLogo({ eager = false }: { eager?: boolean }) {
	return (
		<Image
			className='brand-logo-image'
			src={brandLogo}
			alt=''
			sizes='(max-width: 640px) 130px, 150px'
			loading={eager ? 'eager' : 'lazy'}
		/>
	);
}
