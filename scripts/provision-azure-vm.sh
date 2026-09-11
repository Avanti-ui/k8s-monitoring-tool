#!/usr/bin/env bash
set -euo pipefail

# Configuration Defaults
RESOURCE_GROUP="${RESOURCE_GROUP:-k8s-monitor-rg}"
LOCATION="${LOCATION:-eastus}"
VM_NAME="${VM_NAME:-k8s-monitor-vm}"
VM_SIZE="${VM_SIZE:-Standard_D4s_v5}"   # 4 vCPUs, 16 GiB RAM
IMAGE="${IMAGE:-Ubuntu2204}"
ADMIN_USER="${ADMIN_USER:-azureuser}"

echo "================================================================"
echo " ☁️ Azure VM Provisioning: ${VM_NAME} (${VM_SIZE})"
echo " Resources: 4 vCPUs, 16 GB RAM"
echo " Location:  ${LOCATION}"
echo " RG:        ${RESOURCE_GROUP}"
echo "================================================================"



echo "▶ Checking Azure authentication..."
az account show >/dev/null 2>&1 || az login

echo "▶ Creating Resource Group '${RESOURCE_GROUP}' in '${LOCATION}'..."
az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}" --output table

echo "▶ Provisioning VM '${VM_NAME}' with size '${VM_SIZE}'..."
az vm create \
  --resource-group "${RESOURCE_GROUP}" \
  --name "${VM_NAME}" \
  --image "${IMAGE}" \
  --size "${VM_SIZE}" \
  --admin-username "${ADMIN_USER}" \
  --generate-ssh-keys \
  --public-ip-sku Standard \
  --output table

echo "▶ Configuring Network Security Group (NSG) rules..."
az vm open-port --resource-group "${RESOURCE_GROUP}" --name "${VM_NAME}" --port 22 --priority 1000 --output table
az vm open-port --resource-group "${RESOURCE_GROUP}" --name "${VM_NAME}" --port 80 --priority 1010 --output table
az vm open-port --resource-group "${RESOURCE_GROUP}" --name "${VM_NAME}" --port 443 --priority 1020 --output table

PUBLIC_IP=$(az vm show -d -g "${RESOURCE_GROUP}" -n "${VM_NAME}" --query publicIps -o tsv)

echo ""
echo "================================================================"
echo " ✅ Azure VM Provisioned Successfully!"
echo "================================================================"
echo " VM Name:       ${VM_NAME}"
echo " Size:          ${VM_SIZE} (4 vCPUs, 16 GB RAM)"
echo " Public IP:     ${PUBLIC_IP}"
echo " Admin User:    ${ADMIN_USER}"
echo ""
echo "▶ To SSH into your VM:"
echo "   ssh ${ADMIN_USER}@${PUBLIC_IP}"
echo ""
echo "▶ To run the deployment script directly inside the VM:"
echo "   ssh ${ADMIN_USER}@${PUBLIC_IP} 'git clone https://github.com/Avanti-ui/k8s-monitoring-tool.git && cd k8s-monitoring-tool && sudo ./scripts/deploy-azure-vm.sh'"
echo "================================================================"
