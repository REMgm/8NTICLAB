import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Agent Power Up — Make your business callable',description:'Connect your business once. Publish a hosted agent node, prove a real call, and see what works. Free MVP.',robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
