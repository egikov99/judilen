"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ServiceEditorModal, type HouseRow, type OptionRow, type ServiceRow } from "@/components/admin/service-editor-modal";
import { formatCurrency } from "@/components/currency";
import type { Permission } from "@judilen/auth";

export function ServiceManager({ services, options, houses, serviceHouseIds, permissions }: {
  services: ServiceRow[];
  options: OptionRow[];
  houses: HouseRow[];
  serviceHouseIds: Record<string, string[]>;
  permissions: Permission[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ServiceRow | null | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const [deletingId, setDeletingId] = useState("");

  function changed(message: string) {
    setNotice(message);
    router.refresh();
  }

  async function remove(service: ServiceRow) {
    if (!confirm(`Удалить услугу «${service.title}»?`)) return;
    setDeletingId(service.id);
    const response = await fetch(`/api/admin/services/${service.id}`, { method: "DELETE" });
    setDeletingId("");
    if (!response.ok) return setNotice("Не удалось удалить услугу");
    setNotice("Услуга удалена");
    router.refresh();
  }

  const canCreate = permissions.includes("services.create");
  const canUpdate = permissions.includes("services.update");
  const canDelete = permissions.includes("services.delete");
  return <div className="form-stack">
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="admin-list-toolbar"><div><strong>{services.length}</strong> услуг</div>{canCreate && <button className="button button-primary" onClick={() => setSelected(null)}>Добавить услугу</button>}</div>
    <section className="panel">
      <table className="data-table"><thead><tr><th>Услуга</th><th>Цена</th><th>Варианты</th><th>Публикация</th>{(canUpdate || canDelete) && <th>Действия</th>}</tr></thead><tbody>{services.map((service) => <tr key={service.id}><td><strong>{service.title}</strong><br /><small>/{service.slug}</small></td><td>{formatCurrency(Number(service.basePrice))}</td><td>{options.filter((option) => option.serviceId === service.id).length}</td><td><span className={`badge ${service.isActive ? "" : "badge-warn"}`}>{service.isActive ? "Активна" : "Скрыта"}</span></td>{(canUpdate || canDelete) && <td><div className="action-row">{canUpdate && <button className="button button-ghost" onClick={() => setSelected(service)}>Редактировать</button>}{canDelete && <button className="button button-ghost" disabled={deletingId === service.id} onClick={() => remove(service)}>{deletingId === service.id ? "Удаление…" : "Удалить"}</button>}</div></td>}</tr>)}</tbody></table>
      {!services.length && <p className="notice">Услуг пока нет.</p>}
    </section>
    {selected !== undefined && <ServiceEditorModal
      key={selected?.id ?? "new"}
      service={selected}
      initialOptions={selected ? options.filter((option) => option.serviceId === selected.id) : []}
      houses={houses}
      houseIds={selected ? serviceHouseIds[selected.id] ?? [] : []}
      onClose={() => setSelected(undefined)}
      onChanged={changed}
      optionPermissions={{ create: permissions.includes("service_options.create"), update: permissions.includes("service_options.update"), delete: permissions.includes("service_options.delete") }}
    />}
  </div>;
}
