/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "nodemailer"],
  turbopack: {},
};

export default nextConfig;
