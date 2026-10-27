const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HealthcareRegistry", function () {
  let registry;
  let authority, other, hospitalAddr, doctorAddr, patientAddr, patientAddr2;

  const DEVICE_ID = ethers.id("device-001");
  const DEVICE_ID_2 = ethers.id("device-002");
  const SENSOR_MAC = ethers.id("AA:BB:CC:DD:EE:FF");
  const PROFILE_HASH = ethers.id("patient-profile-1");
  const PROFILE_HASH_2 = ethers.id("patient-profile-2");

  beforeEach(async function () {
    [authority, other, hospitalAddr, doctorAddr, patientAddr, patientAddr2] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory(
      "HealthcareRegistry",
      authority
    );
    registry = await Factory.deploy();
    await registry.waitForDeployment();
  });

  // ==================================================================
  //  Constructor & Authority
  // ==================================================================
  describe("Constructor", function () {
    it("sets the deployer as trustedAuthority", async function () {
      expect(await registry.trustedAuthority()).to.equal(authority.address);
    });

    it("initializes blockedUnauthorizedAttempts to 0", async function () {
      expect(await registry.blockedUnauthorizedAttempts()).to.equal(0);
    });
  });

  // ==================================================================
  //  Hospital Registration
  // ==================================================================
  describe("registerHospital", function () {
    it("registers a hospital and stores correct fields", async function () {
      const tx = await registry.registerHospital(
        hospitalAddr.address,
        "City Hospital"
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const h = await registry.hospitals(hospitalAddr.address);
      expect(h.hospitalAddr).to.equal(hospitalAddr.address);
      expect(h.name).to.equal("City Hospital");
      expect(h.registeredAt).to.equal(block.timestamp);
      expect(h.isRegistered).to.be.true;
    });

    it("emits EntityRegistered with correct args", async function () {
      await expect(
        registry.registerHospital(hospitalAddr.address, "City Hospital")
      )
        .to.emit(registry, "EntityRegistered")
        .withArgs("Hospital", hospitalAddr.address, () => true);
    });

    it("reverts for unauthorized caller", async function () {
      await expect(
        registry
          .connect(other)
          .registerHospital(hospitalAddr.address, "City Hospital")
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("reverts for zero address", async function () {
      await expect(
        registry.registerHospital(ethers.ZeroAddress, "City Hospital")
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");
    });

    it("reverts for empty name", async function () {
      await expect(
        registry.registerHospital(hospitalAddr.address, "")
      ).to.be.revertedWithCustomError(registry, "InvalidName");
    });

    it("reverts on duplicate registration", async function () {
      await registry.registerHospital(hospitalAddr.address, "City Hospital");
      await expect(
        registry.registerHospital(hospitalAddr.address, "Other Hospital")
      ).to.be.revertedWithCustomError(registry, "HospitalAlreadyRegistered");
    });

    it("does not overwrite existing record on duplicate attempt", async function () {
      await registry.registerHospital(hospitalAddr.address, "City Hospital");
      try {
        await registry.registerHospital(hospitalAddr.address, "Overwrite");
      } catch (_) {}
      const h = await registry.hospitals(hospitalAddr.address);
      expect(h.name).to.equal("City Hospital");
    });
  });

  // ==================================================================
  //  Doctor Registration
  // ==================================================================
  describe("registerDoctor", function () {
    it("registers a doctor and stores correct fields", async function () {
      const tx = await registry.registerDoctor(
        doctorAddr.address,
        "LIC-12345"
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const d = await registry.doctors(doctorAddr.address);
      expect(d.doctorAddr).to.equal(doctorAddr.address);
      expect(d.licenseHash).to.equal("LIC-12345");
      expect(d.registeredAt).to.equal(block.timestamp);
      expect(d.isRegistered).to.be.true;
    });

    it("emits EntityRegistered with correct args", async function () {
      await expect(
        registry.registerDoctor(doctorAddr.address, "LIC-12345")
      )
        .to.emit(registry, "EntityRegistered")
        .withArgs("Doctor", doctorAddr.address, () => true);
    });

    it("reverts for unauthorized caller", async function () {
      await expect(
        registry
          .connect(other)
          .registerDoctor(doctorAddr.address, "LIC-12345")
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("reverts for zero address", async function () {
      await expect(
        registry.registerDoctor(ethers.ZeroAddress, "LIC-12345")
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");
    });

    it("reverts for empty licenseHash", async function () {
      await expect(
        registry.registerDoctor(doctorAddr.address, "")
      ).to.be.revertedWithCustomError(registry, "InvalidLicenseHash");
    });

    it("reverts on duplicate registration", async function () {
      await registry.registerDoctor(doctorAddr.address, "LIC-12345");
      await expect(
        registry.registerDoctor(doctorAddr.address, "LIC-99999")
      ).to.be.revertedWithCustomError(registry, "DoctorAlreadyRegistered");
    });
  });

  // ==================================================================
  //  Patient Registration
  // ==================================================================
  describe("registerPatient", function () {
    it("registers a patient and stores correct fields", async function () {
      const tx = await registry.registerPatient(
        patientAddr.address,
        PROFILE_HASH
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const p = await registry.patients(patientAddr.address);
      expect(p.patientAddr).to.equal(patientAddr.address);
      expect(p.profileHash).to.equal(PROFILE_HASH);
      expect(p.registeredAt).to.equal(block.timestamp);
      expect(p.isRegistered).to.be.true;
    });

    it("emits EntityRegistered with correct args", async function () {
      await expect(
        registry.registerPatient(patientAddr.address, PROFILE_HASH)
      )
        .to.emit(registry, "EntityRegistered")
        .withArgs("Patient", patientAddr.address, () => true);
    });

    it("reverts for unauthorized caller", async function () {
      await expect(
        registry
          .connect(other)
          .registerPatient(patientAddr.address, PROFILE_HASH)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("reverts for zero address", async function () {
      await expect(
        registry.registerPatient(ethers.ZeroAddress, PROFILE_HASH)
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");
    });

    it("reverts for zero profileHash", async function () {
      await expect(
        registry.registerPatient(patientAddr.address, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(registry, "InvalidProfileHash");
    });

    it("reverts on duplicate registration", async function () {
      await registry.registerPatient(patientAddr.address, PROFILE_HASH);
      await expect(
        registry.registerPatient(patientAddr.address, PROFILE_HASH_2)
      ).to.be.revertedWithCustomError(registry, "PatientAlreadyRegistered");
    });
  });

  // ==================================================================
  //  IoT Device Registration
  // ==================================================================
  describe("registerIoTDevice", function () {
    beforeEach(async function () {
      await registry.registerPatient(patientAddr.address, PROFILE_HASH);
    });

    it("registers a device and stores correct fields", async function () {
      const tx = await registry.registerIoTDevice(
        DEVICE_ID,
        patientAddr.address,
        SENSOR_MAC
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      const dev = await registry.devices(DEVICE_ID);
      expect(dev.deviceId).to.equal(DEVICE_ID);
      expect(dev.ownerPatient).to.equal(patientAddr.address);
      expect(dev.sensorMacHash).to.equal(SENSOR_MAC);
      expect(dev.registeredAt).to.equal(block.timestamp);
      expect(dev.isRegistered).to.be.true;
    });

    it("emits DeviceRegistered with correct args", async function () {
      await expect(
        registry.registerIoTDevice(DEVICE_ID, patientAddr.address, SENSOR_MAC)
      )
        .to.emit(registry, "DeviceRegistered")
        .withArgs(DEVICE_ID, patientAddr.address, SENSOR_MAC, () => true);
    });

    it("reverts for unauthorized caller", async function () {
      await expect(
        registry
          .connect(other)
          .registerIoTDevice(DEVICE_ID, patientAddr.address, SENSOR_MAC)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("reverts for zero deviceId", async function () {
      await expect(
        registry.registerIoTDevice(
          ethers.ZeroHash,
          patientAddr.address,
          SENSOR_MAC
        )
      ).to.be.revertedWithCustomError(registry, "InvalidDeviceId");
    });

    it("reverts for zero sensorMacHash", async function () {
      await expect(
        registry.registerIoTDevice(
          DEVICE_ID,
          patientAddr.address,
          ethers.ZeroHash
        )
      ).to.be.revertedWithCustomError(registry, "InvalidSensorMacHash");
    });

    it("reverts if ownerPatient is not registered", async function () {
      await expect(
        registry.registerIoTDevice(DEVICE_ID, patientAddr2.address, SENSOR_MAC)
      ).to.be.revertedWithCustomError(registry, "PatientNotRegistered");
    });

    it("reverts on duplicate device registration", async function () {
      await registry.registerIoTDevice(
        DEVICE_ID,
        patientAddr.address,
        SENSOR_MAC
      );
      await expect(
        registry.registerIoTDevice(
          DEVICE_ID,
          patientAddr.address,
          SENSOR_MAC
        )
      ).to.be.revertedWithCustomError(registry, "DeviceAlreadyRegistered");
    });

    it("does not overwrite existing device on duplicate attempt", async function () {
      const sensorMac2 = ethers.id("11:22:33:44:55:66");
      await registry.registerIoTDevice(
        DEVICE_ID,
        patientAddr.address,
        SENSOR_MAC
      );
      try {
        await registry.registerIoTDevice(
          DEVICE_ID,
          patientAddr.address,
          sensorMac2
        );
      } catch (_) {}
      const dev = await registry.devices(DEVICE_ID);
      expect(dev.sensorMacHash).to.equal(SENSOR_MAC);
    });
  });

  // ==================================================================
  //  Quarantine
  // ==================================================================
  describe("quarantineDevice", function () {
    beforeEach(async function () {
      await registry.registerPatient(patientAddr.address, PROFILE_HASH);
      await registry.registerIoTDevice(
        DEVICE_ID,
        patientAddr.address,
        SENSOR_MAC
      );
    });

    it("quarantines a device with valid confidence (8501 bps)", async function () {
      await registry.quarantineDevice(DEVICE_ID, "DDoS", 8501);
      expect(await registry.isDeviceQuarantined(DEVICE_ID)).to.be.true;
      expect(await registry.quarantineReason(DEVICE_ID)).to.equal("DDoS");
    });

    it("quarantines at maximum confidence (10000 bps)", async function () {
      await registry.quarantineDevice(DEVICE_ID, "Replay", 10000);
      expect(await registry.isDeviceQuarantined(DEVICE_ID)).to.be.true;
      expect(await registry.quarantineReason(DEVICE_ID)).to.equal("Replay");
    });

    it("emits DeviceQuarantined with correct args", async function () {
      await expect(registry.quarantineDevice(DEVICE_ID, "MitM", 9500))
        .to.emit(registry, "DeviceQuarantined")
        .withArgs(DEVICE_ID, "MitM", 9500, () => true);
    });

    it("reverts for unauthorized caller", async function () {
      await expect(
        registry.connect(other).quarantineDevice(DEVICE_ID, "DDoS", 9000)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("reverts for unregistered device", async function () {
      const fakeId = ethers.id("device-fake");
      await expect(
        registry.quarantineDevice(fakeId, "DDoS", 9000)
      ).to.be.revertedWithCustomError(registry, "DeviceNotRegistered");
    });

    it("reverts when confidence is exactly 8500 (at threshold)", async function () {
      await expect(
        registry.quarantineDevice(DEVICE_ID, "DDoS", 8500)
      ).to.be.revertedWithCustomError(registry, "ConfidenceBelowThreshold");
    });

    it("reverts when confidence is below 8500", async function () {
      await expect(
        registry.quarantineDevice(DEVICE_ID, "DDoS", 5000)
      ).to.be.revertedWithCustomError(registry, "ConfidenceBelowThreshold");
    });

    it("reverts when confidence exceeds 10000", async function () {
      await expect(
        registry.quarantineDevice(DEVICE_ID, "DDoS", 10001)
      ).to.be.revertedWithCustomError(registry, "ConfidenceTooHigh");
    });

    it("reverts on repeated quarantine of same device", async function () {
      await registry.quarantineDevice(DEVICE_ID, "DDoS", 9000);
      await expect(
        registry.quarantineDevice(DEVICE_ID, "Replay", 9500)
      ).to.be.revertedWithCustomError(registry, "DeviceAlreadyQuarantined");
    });

    it("quarantine status remains unchanged after repeated quarantine attempt", async function () {
      await registry.quarantineDevice(DEVICE_ID, "DDoS", 9000);
      try {
        await registry.quarantineDevice(DEVICE_ID, "Replay", 9500);
      } catch (_) {}
      expect(await registry.isDeviceQuarantined(DEVICE_ID)).to.be.true;
      expect(await registry.quarantineReason(DEVICE_ID)).to.equal("DDoS");
    });
  });

  // ==================================================================
  //  Telemetry Check
  // ==================================================================
  describe("recordDeviceTelemetryCheck", function () {
    beforeEach(async function () {
      await registry.registerPatient(patientAddr.address, PROFILE_HASH);
      await registry.registerIoTDevice(
        DEVICE_ID,
        patientAddr.address,
        SENSOR_MAC
      );
    });

    it("reverts for unauthorized caller", async function () {
      await expect(
        registry.connect(other).recordDeviceTelemetryCheck(DEVICE_ID)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("returns true for a registered, non-quarantined device", async function () {
      const result =
        await registry.recordDeviceTelemetryCheck.staticCall(DEVICE_ID);
      expect(result).to.be.true;
    });

    it("does not increment counter for non-quarantined device", async function () {
      await registry.recordDeviceTelemetryCheck(DEVICE_ID);
      expect(await registry.blockedUnauthorizedAttempts()).to.equal(0);
    });

    it("reverts for unregistered device", async function () {
      const fakeId = ethers.id("device-fake");
      await expect(
        registry.recordDeviceTelemetryCheck(fakeId)
      ).to.be.revertedWithCustomError(registry, "DeviceNotRegistered");
    });

    it("does not increment counter when reverting for unregistered device", async function () {
      const fakeId = ethers.id("device-fake");
      try {
        await registry.recordDeviceTelemetryCheck(fakeId);
      } catch (_) {}
      expect(await registry.blockedUnauthorizedAttempts()).to.equal(0);
    });

    describe("quarantined device", function () {
      beforeEach(async function () {
        await registry.quarantineDevice(DEVICE_ID, "DDoS", 9000);
      });

      it("returns false without reverting", async function () {
        const result =
          await registry.recordDeviceTelemetryCheck.staticCall(DEVICE_ID);
        expect(result).to.be.false;
      });

      it("increments blockedUnauthorizedAttempts", async function () {
        await registry.recordDeviceTelemetryCheck(DEVICE_ID);
        expect(await registry.blockedUnauthorizedAttempts()).to.equal(1);
      });

      it("emits UnauthorizedTelemetryBlocked with correct args", async function () {
        await expect(registry.recordDeviceTelemetryCheck(DEVICE_ID))
          .to.emit(registry, "UnauthorizedTelemetryBlocked")
          .withArgs(DEVICE_ID, authority.address, 1);
      });

      it("persists counter and events after multiple blocked checks", async function () {
        await registry.recordDeviceTelemetryCheck(DEVICE_ID);
        await registry.recordDeviceTelemetryCheck(DEVICE_ID);

        const tx = await registry.recordDeviceTelemetryCheck(DEVICE_ID);
        await expect(tx)
          .to.emit(registry, "UnauthorizedTelemetryBlocked")
          .withArgs(DEVICE_ID, authority.address, 3);

        expect(await registry.blockedUnauthorizedAttempts()).to.equal(3);
      });

      it("persisted state is readable after blocked check", async function () {
        await registry.recordDeviceTelemetryCheck(DEVICE_ID);

        const counter = await registry.blockedUnauthorizedAttempts();
        expect(counter).to.equal(1);

        expect(await registry.isDeviceQuarantined(DEVICE_ID)).to.be.true;
        expect(await registry.quarantineReason(DEVICE_ID)).to.equal("DDoS");
      });
    });
  });
});

