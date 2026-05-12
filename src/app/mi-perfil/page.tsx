"use client";

import dynamic from "next/dynamic";

const ProfileView = dynamic(() => import("./ProfileView"), { ssr: false });

export default function MiPerfilPage() {
  return <ProfileView />;
}
