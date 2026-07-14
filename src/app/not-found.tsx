import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center !bg-[#F2F4F7] px-4 dark:!bg-[#09090b]">
      <div className="text-center">
        <p className="text-7xl font-black text-primary sm:text-9xl">৪০৪</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
          পেজ পাওয়া যায়নি
        </h1>
        <p className="mt-3 max-w-md text-base text-muted-foreground">
          আপনি যেই পেজটি খুঁজছেন সেটি অস্তিত্বে নেই বা সরানো হয়েছে।
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-[15px] font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30"
          >
            হোমে ফিরে যান
          </Link>
        </div>
      </div>
    </div>
  );
}