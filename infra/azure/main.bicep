// Clinithetics: one environment (prod or staging) in Azure South Africa North.
//
// Deployed by infra/azure/deploy.sh. Creates the server, its data disk,
// backups, secrets vault, monitoring and the email service. Nothing here holds
// a secret; the server generates its own and stores them in Key Vault.

targetScope = 'resourceGroup'

@allowed(['prod', 'staging'])
param env string

@description('Azure region. South Africa North keeps patient data in South Africa.')
param location string = 'southafricanorth'

@description('Public API host name, e.g. api.clinithetics.beedab.com')
param apiHostname string

@description('Where alerts (server down, disk full, backup missing) are emailed.')
param alertEmail string

@description('SSH public key for the server admin account.')
param adminSshPublicKey string

param adminUsername string = 'clinadmin'

@description('Object ID of the person deploying (az ad signed-in-user show --query id). Gets access to the deploy files, backups and secrets.')
param deployerObjectId string

@description('User when a person deploys from Cloud Shell; ServicePrincipal when an app login (e.g. Codex or CI) deploys.')
@allowed(['User', 'ServicePrincipal'])
param deployerPrincipalType string = 'User'

@description('Optional: one IP range allowed to SSH in (e.g. "196.25.1.10/32"). Empty = no SSH from the internet.')
param sshSourceCidr string = ''

@description('Add Azure Bastion (browser SSH; about US$140/month). Off by default: setup runs through az vm run-command instead.')
param deployBastion bool = false

@description('Where Azure Communication Services keeps email data.')
param emailDataLocation string = 'Africa'

param vmSize string = env == 'prod' ? 'Standard_D4s_v5' : 'Standard_B2ms'
param dataDiskSizeGb int = env == 'prod' ? 128 : 64

var name = 'clin-${env}'
var suffix = take(uniqueString(resourceGroup().id), 6)
var tags = {
  app: 'clinithetics'
  env: env
  'data-classification': 'health'
}
var addressSpace = env == 'prod' ? '10.20.0.0/16' : '10.21.0.0/16'
var subnetPrefix = env == 'prod' ? '10.20.1.0/24' : '10.21.1.0/24'
var bastionPrefix = env == 'prod' ? '10.20.2.0/26' : '10.21.2.0/26'
var backupRetentionDays = env == 'prod' ? 35 : 7

// Built-in role IDs
var roleBlobContributor = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
var roleBlobReader = '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
var roleKvSecretsOfficer = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'

// ---------------------------------------------------------------------------
// Network: only HTTPS (443) and HTTP (80, for certificate issuance and the
// redirect to HTTPS) are open. SSH only from sshSourceCidr, if given.

var baseRules = [
  {
    name: 'allow-https'
    properties: {
      priority: 100
      direction: 'Inbound'
      access: 'Allow'
      protocol: 'Tcp'
      sourceAddressPrefix: 'Internet'
      sourcePortRange: '*'
      destinationAddressPrefix: '*'
      destinationPortRange: '443'
    }
  }
  {
    name: 'allow-http-for-certificates'
    properties: {
      priority: 110
      direction: 'Inbound'
      access: 'Allow'
      protocol: 'Tcp'
      sourceAddressPrefix: 'Internet'
      sourcePortRange: '*'
      destinationAddressPrefix: '*'
      destinationPortRange: '80'
    }
  }
]
var sshRule = empty(sshSourceCidr) ? [] : [
  {
    name: 'allow-ssh-from-admin'
    properties: {
      priority: 120
      direction: 'Inbound'
      access: 'Allow'
      protocol: 'Tcp'
      sourceAddressPrefix: sshSourceCidr
      sourcePortRange: '*'
      destinationAddressPrefix: '*'
      destinationPortRange: '22'
    }
  }
]

resource nsg 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: '${name}-nsg'
  location: location
  tags: tags
  properties: {
    securityRules: concat(baseRules, sshRule)
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${name}-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: [addressSpace] }
    subnets: concat([
      {
        name: 'server'
        properties: {
          addressPrefix: subnetPrefix
          networkSecurityGroup: { id: nsg.id }
        }
      }
    ], deployBastion ? [
      {
        name: 'AzureBastionSubnet'
        properties: { addressPrefix: bastionPrefix }
      }
    ] : [])
  }
}

resource publicIp 'Microsoft.Network/publicIPAddresses@2024-05-01' = {
  name: '${name}-ip'
  location: location
  tags: tags
  sku: { name: 'Standard' }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: { domainNameLabel: 'clinithetics-${env}-${suffix}' }
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2024-05-01' = {
  name: '${name}-nic'
  location: location
  tags: tags
  properties: {
    ipConfigurations: [
      {
        name: 'primary'
        properties: {
          subnet: { id: vnet.properties.subnets[0].id }
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: { id: publicIp.id }
        }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Server: Ubuntu 24.04 with a separate data disk for the database and files.

resource vm 'Microsoft.Compute/virtualMachines@2024-07-01' = {
  name: '${name}-vm'
  location: location
  tags: tags
  identity: { type: 'SystemAssigned' }
  properties: {
    hardwareProfile: { vmSize: vmSize }
    securityProfile: {
      securityType: 'TrustedLaunch'
      uefiSettings: {
        secureBootEnabled: true
        vTpmEnabled: true
      }
    }
    osProfile: {
      computerName: '${name}-vm'
      adminUsername: adminUsername
      customData: base64(loadTextContent('cloud-init.yaml'))
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            {
              path: '/home/${adminUsername}/.ssh/authorized_keys'
              keyData: adminSshPublicKey
            }
          ]
        }
        patchSettings: {
          patchMode: 'ImageDefault'
          assessmentMode: 'ImageDefault'
        }
      }
    }
    storageProfile: {
      imageReference: {
        publisher: 'Canonical'
        offer: 'ubuntu-24_04-lts'
        sku: 'server'
        version: 'latest'
      }
      osDisk: {
        name: '${name}-osdisk'
        createOption: 'FromImage'
        diskSizeGB: 64
        managedDisk: { storageAccountType: 'Premium_LRS' }
        deleteOption: 'Detach'
      }
      dataDisks: [
        {
          name: '${name}-datadisk'
          lun: 0
          createOption: 'Empty'
          diskSizeGB: dataDiskSizeGb
          caching: 'ReadOnly'
          managedDisk: { storageAccountType: 'Premium_LRS' }
          deleteOption: 'Detach'
        }
      ]
    }
    networkProfile: {
      networkInterfaces: [{ id: nic.id }]
    }
    diagnosticsProfile: {
      bootDiagnostics: { enabled: true }
    }
  }
}

// ---------------------------------------------------------------------------
// Storage for backups and deploy files. Zone-redundant within South Africa
// North; only Entra ID sign-in (no account keys); no public blobs.

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take('stclin${env}${uniqueString(resourceGroup().id)}', 24)
  location: location
  tags: tags
  sku: { name: 'Standard_ZRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    allowCrossTenantReplication: false
    publicNetworkAccess: 'Enabled'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    deleteRetentionPolicy: { enabled: true, days: 14 }
    containerDeleteRetentionPolicy: { enabled: true, days: 14 }
  }
}

resource backupContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'db-backups'
  properties: { publicAccess: 'None' }
}

// Backups can't be changed or deleted for the retention period, even by an
// admin (protects against ransomware and mistakes). The policy starts
// unlocked so it can be adjusted; lock it once you're happy (see README).
resource backupImmutability 'Microsoft.Storage/storageAccounts/blobServices/containers/immutabilityPolicies@2023-05-01' = {
  parent: backupContainer
  name: 'default'
  properties: {
    immutabilityPeriodSinceCreationInDays: backupRetentionDays
    allowProtectedAppendWrites: false
  }
}

resource deployContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'deploy'
  properties: { publicAccess: 'None' }
}

resource lifecycle 'Microsoft.Storage/storageAccounts/managementPolicies@2023-05-01' = {
  parent: storage
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'expire-old-backups'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['db-backups/']
            }
            actions: {
              baseBlob: {
                tierToCool: { daysAfterModificationGreaterThan: 7 }
                delete: { daysAfterModificationGreaterThan: backupRetentionDays + 5 }
              }
            }
          }
        }
        {
          name: 'expire-old-deploy-bundles'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['deploy/']
            }
            actions: {
              baseBlob: {
                delete: { daysAfterModificationGreaterThan: 90 }
              }
            }
          }
        }
      ]
    }
  }
}

// ---------------------------------------------------------------------------
// Key Vault: the server writes its generated secrets here on first setup.

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-clin-${env}-${suffix}'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
  }
}

// ---------------------------------------------------------------------------
// Access: the server can write backups, read deploy files and manage its own
// secrets; the deployer can upload deploy files, read backups and secrets.

resource vmBackupWriter 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: backupContainer
  name: guid(backupContainer.id, vm.id, roleBlobContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleBlobContributor)
    principalId: vm.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource vmDeployReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: deployContainer
  name: guid(deployContainer.id, vm.id, roleBlobReader)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleBlobReader)
    principalId: vm.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource vmSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, vm.id, roleKvSecretsOfficer)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKvSecretsOfficer)
    principalId: vm.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource deployerBlobs 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, deployerObjectId, roleBlobContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleBlobContributor)
    principalId: deployerObjectId
    principalType: deployerPrincipalType
  }
}

resource deployerSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, deployerObjectId, roleKvSecretsOfficer)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKvSecretsOfficer)
    principalId: deployerObjectId
    principalType: deployerPrincipalType
  }
}

// ---------------------------------------------------------------------------
// Server snapshots: daily, kept 30 days (second line behind database backups).

resource recoveryVault 'Microsoft.RecoveryServices/vaults@2024-04-01' = {
  name: '${name}-rsv'
  location: location
  tags: tags
  sku: { name: 'RS0', tier: 'Standard' }
  properties: {
    publicNetworkAccess: 'Enabled'
    monitoringSettings: {
      azureMonitorAlertSettings: { alertsForAllJobFailures: 'Enabled' }
      classicAlertSettings: { alertsForCriticalOperations: 'Disabled' }
    }
  }
}

// Trusted Launch servers need the Enhanced (V2) policy.
resource vmBackupPolicy 'Microsoft.RecoveryServices/vaults/backupPolicies@2024-04-01' = {
  parent: recoveryVault
  name: 'daily-30-days'
  properties: {
    backupManagementType: 'AzureIaasVM'
    policyType: 'V2'
    instantRpRetentionRangeInDays: 2
    timeZone: 'UTC'
    schedulePolicy: {
      schedulePolicyType: 'SimpleSchedulePolicyV2'
      scheduleRunFrequency: 'Daily'
      dailySchedule: { scheduleRunTimes: ['2026-01-01T22:00:00Z'] }
    }
    retentionPolicy: {
      retentionPolicyType: 'LongTermRetentionPolicy'
      dailySchedule: {
        retentionTimes: ['2026-01-01T22:00:00Z']
        retentionDuration: { count: 30, durationType: 'Days' }
      }
    }
  }
}

var protectionContainer = 'iaasvmcontainer;iaasvmcontainerv2;${resourceGroup().name};${vm.name}'
var protectedItem = 'vm;iaasvmcontainerv2;${resourceGroup().name};${vm.name}'

resource vmProtection 'Microsoft.RecoveryServices/vaults/backupFabrics/protectionContainers/protectedItems@2024-04-01' = {
  name: '${recoveryVault.name}/Azure/${protectionContainer}/${protectedItem}'
  properties: {
    protectedItemType: 'Microsoft.Compute/virtualMachines'
    policyId: vmBackupPolicy.id
    sourceResourceId: vm.id
  }
}

// ---------------------------------------------------------------------------
// Monitoring: disk use and backup heartbeats from the server, plus alerts.

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${name}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource dcr 'Microsoft.Insights/dataCollectionRules@2023-03-11' = {
  name: '${name}-dcr'
  location: location
  tags: tags
  kind: 'Linux'
  properties: {
    dataSources: {
      performanceCounters: [
        {
          name: 'disk-and-cpu'
          streams: ['Microsoft-Perf']
          samplingFrequencyInSeconds: 300
          counterSpecifiers: [
            'Logical Disk(*)\\% Used Space'
            'Processor(*)\\% Processor Time'
            'Memory(*)\\% Used Memory'
          ]
        }
      ]
      syslog: [
        {
          name: 'backup-heartbeats'
          streams: ['Microsoft-Syslog']
          facilityNames: ['user']
          logLevels: ['Info', 'Notice', 'Warning', 'Error', 'Critical', 'Alert', 'Emergency']
        }
      ]
    }
    destinations: {
      logAnalytics: [
        {
          name: 'workspace'
          workspaceResourceId: logs.id
        }
      ]
    }
    dataFlows: [
      {
        streams: ['Microsoft-Perf', 'Microsoft-Syslog']
        destinations: ['workspace']
      }
    ]
  }
}

resource monitorAgent 'Microsoft.Compute/virtualMachines/extensions@2024-07-01' = {
  parent: vm
  name: 'AzureMonitorLinuxAgent'
  location: location
  properties: {
    publisher: 'Microsoft.Azure.Monitor'
    type: 'AzureMonitorLinuxAgent'
    typeHandlerVersion: '1.0'
    autoUpgradeMinorVersion: true
    enableAutomaticUpgrade: true
  }
}

resource dcrLink 'Microsoft.Insights/dataCollectionRuleAssociations@2023-03-11' = {
  scope: vm
  name: '${name}-dcr-link'
  properties: {
    dataCollectionRuleId: dcr.id
  }
}

resource alertGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: '${name}-alerts'
  location: 'Global'
  tags: tags
  properties: {
    groupShortName: 'clin${env}'
    enabled: true
    emailReceivers: [
      {
        name: 'ops'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

resource alertVmDown 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${name}-server-unavailable'
  location: 'global'
  tags: tags
  properties: {
    description: 'The Clinithetics ${env} server is not responding.'
    severity: 0
    enabled: true
    scopes: [vm.id]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          criterionType: 'StaticThresholdCriterion'
          name: 'availability'
          metricNamespace: 'Microsoft.Compute/virtualMachines'
          metricName: 'VmAvailabilityMetric'
          operator: 'LessThan'
          threshold: 1
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [{ actionGroupId: alertGroup.id }]
  }
}

resource alertCpu 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${name}-cpu-high'
  location: 'global'
  tags: tags
  properties: {
    description: 'The Clinithetics ${env} server has been busy (CPU over 85%) for 15 minutes.'
    severity: 2
    enabled: true
    scopes: [vm.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          criterionType: 'StaticThresholdCriterion'
          name: 'cpu'
          metricNamespace: 'Microsoft.Compute/virtualMachines'
          metricName: 'Percentage CPU'
          operator: 'GreaterThan'
          threshold: 85
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [{ actionGroupId: alertGroup.id }]
  }
}

resource alertDisk 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = {
  name: '${name}-disk-filling-up'
  location: location
  tags: tags
  properties: {
    description: 'A disk on the Clinithetics ${env} server is over 80% full.'
    severity: 1
    enabled: true
    scopes: [logs.id]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    criteria: {
      allOf: [
        {
          query: 'Perf | where ObjectName == "Logical Disk" and CounterName == "% Used Space" and InstanceName in ("/", "/srv/supabase") | summarize used = max(CounterValue) by InstanceName'
          timeAggregation: 'Maximum'
          metricMeasureColumn: 'used'
          dimensions: [
            {
              name: 'InstanceName'
              operator: 'Include'
              values: ['*']
            }
          ]
          operator: 'GreaterThan'
          threshold: 80
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: { actionGroups: [alertGroup.id] }
  }
}

// backup.sh writes "clinithetics-backup: backup ok" to syslog after each upload.
resource alertBackupMissing 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = {
  name: '${name}-backup-missing'
  location: location
  tags: tags
  properties: {
    description: 'No successful Clinithetics ${env} database backup in the last 26 hours.'
    severity: 1
    enabled: true
    scopes: [logs.id]
    evaluationFrequency: 'PT1H'
    windowSize: 'P1D'
    overrideQueryTimeRange: 'P2D'
    criteria: {
      allOf: [
        {
          query: 'Syslog | where TimeGenerated > ago(26h) | where SyslogMessage has "clinithetics-backup: backup ok" | summarize ok = count()'
          timeAggregation: 'Total'
          metricMeasureColumn: 'ok'
          operator: 'LessThan'
          threshold: 1
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: { actionGroups: [alertGroup.id] }
  }
}

// Route every alert in this resource group (including Azure Backup's built-in
// job-failure alerts) to the email above.
resource alertRouting 'Microsoft.AlertsManagement/actionRules@2021-08-08' = {
  name: '${name}-email-all-alerts'
  location: 'Global'
  tags: tags
  properties: {
    description: 'Email every alert for the Clinithetics ${env} resources.'
    enabled: true
    scopes: [resourceGroup().id]
    actions: [
      {
        actionType: 'AddActionGroups'
        actionGroupIds: [alertGroup.id]
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Email for sign-up confirmations, password resets and invitations.

resource emailService 'Microsoft.Communication/emailServices@2023-04-01' = {
  name: '${name}-email-${suffix}'
  location: 'global'
  tags: tags
  properties: { dataLocation: emailDataLocation }
}

resource emailDomain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: emailService
  name: 'AzureManagedDomain'
  location: 'global'
  tags: tags
  properties: {
    domainManagement: 'AzureManaged'
    userEngagementTracking: 'Disabled'
  }
}

resource communication 'Microsoft.Communication/communicationServices@2023-04-01' = {
  name: '${name}-acs-${suffix}'
  location: 'global'
  tags: tags
  properties: {
    dataLocation: emailDataLocation
    linkedDomains: [emailDomain.id]
  }
}

// ---------------------------------------------------------------------------
// Optional browser-based SSH.

resource bastionIp 'Microsoft.Network/publicIPAddresses@2024-05-01' = if (deployBastion) {
  name: '${name}-bastion-ip'
  location: location
  tags: tags
  sku: { name: 'Standard' }
  properties: { publicIPAllocationMethod: 'Static' }
}

resource bastion 'Microsoft.Network/bastionHosts@2024-05-01' = if (deployBastion) {
  name: '${name}-bastion'
  location: location
  tags: tags
  sku: { name: 'Basic' }
  properties: {
    ipConfigurations: [
      {
        name: 'bastion'
        properties: {
          subnet: { id: '${vnet.id}/subnets/AzureBastionSubnet' }
          publicIPAddress: { id: bastionIp.id }
        }
      }
    ]
  }
}

// ---------------------------------------------------------------------------

output vmName string = vm.name
output publicIp string = publicIp.properties.ipAddress
output azureHostname string = publicIp.properties.dnsSettings.fqdn
output apiHostname string = apiHostname
output storageAccount string = storage.name
output keyVault string = vault.name
output communicationService string = communication.name
output senderAddress string = 'DoNotReply@${emailDomain.properties.mailFromSenderDomain}'
