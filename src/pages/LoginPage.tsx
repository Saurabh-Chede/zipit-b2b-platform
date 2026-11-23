// import React, { useState } from 'react';
// import { Link, useNavigate } from 'react-router-dom';
// import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import { z } from 'zod';
// import { Eye, EyeOff, ArrowRight } from 'lucide-react';
// import { useAuth } from '../context/AuthContext.tsx';
// import { useToast } from '../context/ToastContext.tsx';
// import { extractErrorMessage } from '../services/api.ts';
// import { UserRole } from '../types/index.ts';
// import { BrandMark } from '../components/ui/BrandMark.tsx';

// const loginSchema = z.object({
//   email: z.string().email('Enter a valid email address'),
//   password: z.string().min(6, 'Password must be at least 6 characters'),
// });

// type LoginFormValues = z.infer<typeof loginSchema>;

// export function LoginPage() {
//   const { login } = useAuth();
//   const { showToast } = useToast();
//   const navigate = useNavigate();
//   const [showPassword, setShowPassword] = useState(false);
//   const [serverError, setServerError] = useState<string | null>(null);

//   const {
//     register,
//     handleSubmit,
//     formState: { errors, isSubmitting },
//   } = useForm<LoginFormValues>({
//     resolver: zodResolver(loginSchema),
//   });

//   const onSubmit = async (values: LoginFormValues) => {
//     setServerError(null);
//     try {
//       const loggedUser = await login(values.email, values.password);
//       showToast(`Signed in as ${loggedUser.name}`, 'success');
//       if (loggedUser.role === UserRole.ADMIN) navigate('/admin');
//       else if (loggedUser.role === UserRole.SELLER) navigate('/seller');
//       else navigate('/transporter');
//     } catch (err) {
//       setServerError(extractErrorMessage(err, 'Invalid credentials.'));
//     }
//   };

//   return (
//     <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
//       <div className="sm:mx-auto sm:w-full sm:max-w-md">
//         <div className="flex items-center justify-center gap-3">
//           <img src="https://zipit.co.in/__l5e/assets-v1/fcd52a27-9bc8-4c27-84b3-8484ebfce3f6/zipit-horizontal.png" alt="" />
//         </div>
//         <h1 className="mt-6 text-center text-xl font-semibold text-slate-900">
//           Sign in to your workspace
//         </h1>
//         <p className="mt-1.5 text-center text-sm text-slate-600">
//           Unified dispatch, freight calculation, and consignment tracking
//         </p>
//       </div>

//       <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
//         <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
//           {serverError && (
//             <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
//               {serverError}
//             </div>
//           )}

//           <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
//             <div>
//               <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
//                 Work Email
//               </label>
//               <input
//                 id="email"
//                 type="email"
//                 autoComplete="email"
//                 placeholder="name@company.in"
//                 {...register('email')}
//                 className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
//               />
//               {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
//             </div>

//             <div>
//               <div className="flex items-center justify-between mb-1.5">
//                 <label htmlFor="password" className="block text-sm font-medium text-slate-700">
//                   Password
//                 </label>
//                 <Link
//                   to="/forgot-password"
//                   className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
//                 >
//                   Forgot password?
//                 </Link>
//               </div>
//               <div className="relative">
//                 <input
//                   id="password"
//                   type={showPassword ? 'text' : 'password'}
//                   autoComplete="current-password"
//                   placeholder="Enter your password"
//                   {...register('password')}
//                   className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPassword((p) => !p)}
//                   className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
//                   aria-label={showPassword ? 'Hide password' : 'Show password'}
//                 >
//                   {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
//                 </button>
//               </div>
//               {errors.password && (
//                 <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
//               )}
//             </div>

//             <button
//               type="submit"
//               disabled={isSubmitting}
//               className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
//             >
//               <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
//               <ArrowRight className="w-4 h-4" />
//             </button>
//           </form>

//           <div className="mt-6 pt-5 border-t border-slate-200 space-y-2.5 text-sm">
//             <div className="flex items-center justify-between">
//               <span className="text-slate-600">New B2B seller?</span>
//               <Link
//                 to="/register-seller"
//                 className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
//               >
//                 Register your business
//               </Link>
//             </div>
//             <div className="flex items-center justify-between">
//               <span className="text-slate-600">Consignee checking delivery?</span>
//               <Link
//                 to="/track"
//                 className="font-medium text-slate-800 hover:text-blue-600 hover:underline"
//               >
//                 Track a shipment →
//               </Link>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }


// import React, { useState } from 'react';
// import { Link, useNavigate } from 'react-router-dom';
// import { useForm } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import { z } from 'zod';
// import {
//   Eye,
//   EyeOff,
//   ArrowRight,
//   Truck,
//   Calculator,
//   MapPin,
//   AlertCircle,
// } from 'lucide-react';
// import { useAuth } from '../context/AuthContext.tsx';
// import { useToast } from '../context/ToastContext.tsx';
// import { extractErrorMessage } from '../services/api.ts';
// import { UserRole } from '../types/index.ts';
// import { BrandMark } from '../components/ui/BrandMark.tsx';

// const loginSchema = z.object({
//   email: z.string().email('Enter a valid email address'),
//   password: z.string().min(6, 'Password must be at least 6 characters'),
// });

// type LoginFormValues = z.infer<typeof loginSchema>;

// const highlights = [
//   {
//     icon: Truck,
//     title: 'Unified dispatch',
//     text: 'Book and manage every pickup from one workspace.',
//   },
//   {
//     icon: Calculator,
//     title: 'Instant freight calculation',
//     text: 'Transparent rates before you confirm a consignment.',
//   },
//   {
//     icon: MapPin,
//     title: 'Live consignment tracking',
//     text: 'Follow each shipment from pickup to final delivery.',
//   },
// ];

// export function LoginPage() {
//   const { login } = useAuth();
//   const { showToast } = useToast();
//   const navigate = useNavigate();
//   const [showPassword, setShowPassword] = useState(false);
//   const [serverError, setServerError] = useState<string | null>(null);

//   const {
//     register,
//     handleSubmit,
//     formState: { errors, isSubmitting },
//   } = useForm<LoginFormValues>({
//     resolver: zodResolver(loginSchema),
//   });

//   const onSubmit = async (values: LoginFormValues) => {
//     setServerError(null);
//     try {
//       const loggedUser = await login(values.email, values.password);
//       showToast(`Signed in as ${loggedUser.name}`, 'success');
//       if (loggedUser.role === UserRole.ADMIN) navigate('/admin');
//       else if (loggedUser.role === UserRole.SELLER) navigate('/seller');
//       else navigate('/transporter');
//     } catch (err) {
//       setServerError(extractErrorMessage(err, 'Invalid credentials.'));
//     }
//   };

//   return (
//     <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-white">
//       {/* Brand panel */}
//       <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-slate-900 text-white px-14 py-14">
//         <div
//           aria-hidden="true"
//           className="pointer-events-none absolute inset-0 opacity-60"
//           style={{
//             backgroundImage:
//               'radial-gradient(60rem 30rem at 0% 0%, rgba(37,99,235,0.35), transparent 60%), radial-gradient(40rem 30rem at 100% 100%, rgba(14,165,233,0.18), transparent 60%)',
//           }}
//         />
//         <div
//           aria-hidden="true"
//           className="pointer-events-none absolute inset-0 opacity-[0.07]"
//           style={{
//             backgroundImage:
//               'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
//             backgroundSize: '48px 48px',
//           }}
//         />

//         <div className="relative">
//           <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-slate-200">
//             <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
//             B2B logistics platform
//           </span>
//         </div>

//         <div className="relative max-w-lg">
//           <h2 className="text-4xl font-semibold leading-tight tracking-tight">
//             Ship smarter.
//             <br />
//             <span className="text-blue-400">Track every mile.</span>
//           </h2>
//           <p className="mt-4 text-base text-slate-300 leading-relaxed">
//             Unified dispatch, freight calculation, and consignment tracking for sellers,
//             transporters, and admins.
//           </p>

//           <ul className="mt-10 space-y-6">
//             {highlights.map(({ icon: Icon, title, text }) => (
//               <li key={title} className="flex items-start gap-4">
//                 <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10">
//                   <Icon className="h-5 w-5 text-blue-300" />
//                 </span>
//                 <div>
//                   <p className="text-sm font-semibold text-white">{title}</p>
//                   <p className="mt-0.5 text-sm text-slate-400">{text}</p>
//                 </div>
//               </li>
//             ))}
//           </ul>
//         </div>

//         <p className="relative text-xs text-slate-500">
//           Secure workspace access for verified businesses.
//         </p>
//       </aside>

//       {/* Form panel */}
//       <main className="flex flex-col justify-center bg-slate-50 lg:bg-white px-4 py-12 sm:px-8">
//         <div className="mx-auto w-full max-w-sm">
//           <div className="flex items-center">
//             <img
//               src="https://zipit.co.in/__l5e/assets-v1/fcd52a27-9bc8-4c27-84b3-8484ebfce3f6/zipit-horizontal.png"
//               alt=""
//               className="h-9 w-auto"
//             />
//           </div>

//           <h1 className="mt-10 text-2xl font-semibold tracking-tight text-slate-900">
//             Sign in to your workspace
//           </h1>
//           <p className="mt-2 text-sm text-slate-600">
//             Welcome back. Enter your details to continue.
//           </p>

//           {serverError && (
//             <div
//               role="alert"
//               className="mt-6 flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"
//             >
//               <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
//               <span>{serverError}</span>
//             </div>
//           )}

//           <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
//             <div>
//               <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
//                 Work Email
//               </label>
//               <input
//                 id="email"
//                 type="email"
//                 autoComplete="email"
//                 placeholder="name@company.in"
//                 {...register('email')}
//                 className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
//               />
//               {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
//             </div>

//             <div>
//               <div className="flex items-center justify-between mb-1.5">
//                 <label htmlFor="password" className="block text-sm font-medium text-slate-700">
//                   Password
//                 </label>
//                 <Link
//                   to="/forgot-password"
//                   className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
//                 >
//                   Forgot password?
//                 </Link>
//               </div>
//               <div className="relative">
//                 <input
//                   id="password"
//                   type={showPassword ? 'text' : 'password'}
//                   autoComplete="current-password"
//                   placeholder="Enter your password"
//                   {...register('password')}
//                   className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPassword((p) => !p)}
//                   className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
//                   aria-label={showPassword ? 'Hide password' : 'Show password'}
//                 >
//                   {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
//                 </button>
//               </div>
//               {errors.password && (
//                 <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
//               )}
//             </div>

//             <button
//               type="submit"
//               disabled={isSubmitting}
//               className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
//             >
//               <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
//               <ArrowRight className="w-4 h-4" />
//             </button>
//           </form>

//           <div className="mt-8 grid gap-3 sm:grid-cols-2">
//             <Link
//               to="/register-seller"
//               className="group rounded-lg border border-slate-200 bg-white p-3.5 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
//             >
//               <p className="text-xs text-slate-500">New B2B seller?</p>
//               <p className="mt-0.5 text-sm font-medium text-slate-900 group-hover:text-blue-700">
//                 Register your business →
//               </p>
//             </Link>
//             <Link
//               to="/track"
//               className="group rounded-lg border border-slate-200 bg-white p-3.5 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
//             >
//               <p className="text-xs text-slate-500">Consignee checking delivery?</p>
//               <p className="mt-0.5 text-sm font-medium text-slate-900 group-hover:text-blue-700">
//                 Track a shipment →
//               </p>
//             </Link>
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// }


import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import { extractErrorMessage } from '../services/api.ts';
import { getStoredAuthToken } from '../utils/apiConfig.ts';
import { UserRole } from '../types/index.ts';
import { BrandMark } from '../components/ui/BrandMark.tsx';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function getRoleHome(role: UserRole): string {
  if (role === UserRole.ADMIN) return '/admin';
  if (role === UserRole.SELLER) return '/seller';
  return '/transporter';
}

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  if (loading && getStoredAuthToken()) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-sm text-slate-500">Verifying session...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={getRoleHome(user.role)} replace />;
  }

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      const loggedUser = await login(values.email, values.password);
      showToast(`Signed in as ${loggedUser.name}`, 'success');
      navigate(getRoleHome(loggedUser.role), { replace: true });
    } catch (err) {
      setServerError(extractErrorMessage(err, 'Invalid credentials.'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-3">
          <BrandMark />
          {/* <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
            ZIPIT B2B Transport
          </span> */}
        </div>
        <h1 className="mt-6 text-center text-xl font-semibold text-slate-900">
          Sign in to your workspace
        </h1>
        <p className="mt-1.5 text-center text-sm text-slate-600">
          Unified dispatch, freight calculation, and consignment tracking
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          {serverError && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@company.in"
                {...register('email')}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  {...register('password')}
                  className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">New B2B seller?</span>
              <Link
                to="/register-seller"
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Register your business
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Consignee checking delivery?</span>
              <Link
                to="/track"
                className="font-medium text-slate-800 hover:text-blue-600 hover:underline"
              >
                Track a shipment →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
