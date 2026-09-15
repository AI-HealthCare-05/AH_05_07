import { expect, type Page } from "@playwright/test";

export async function chooseMinuteByKeyboard(
  page: Page,
  id: string,
  minute: number,
) {
  const picker = page.locator(`#${id}-picker`);
  const label = (await page.locator(`#${id}-label`).textContent())?.trim() ?? "";
  const minuteWheel = picker.getByRole("spinbutton", {
    name: `${label} 분`,
  });

  await minuteWheel.focus();

  if (minute === 59) {
    await minuteWheel.press("End");
  } else {
    await minuteWheel.press("Home");
    for (let current = 0; current < minute; current += 1) {
      await minuteWheel.press("ArrowDown");
    }
  }

  await expect(minuteWheel).toHaveAttribute(
    "aria-valuetext",
    `${String(minute).padStart(2, "0")}분`,
  );
}

export async function chooseTime(
  page: Page,
  id: string,
  value: string,
) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const period = hour < 12 ? "오전" : "오후";
  const twelveHour = hour % 12 || 12;
  const trigger = page.locator(`#${id}`);

  if (await trigger.getAttribute("aria-expanded") !== "true") {
    await trigger.click();
  }

  const picker = page.locator(`#${id}-picker`);
  await expect(picker).toBeVisible();

  const label = (await page.locator(`#${id}-label`).textContent())?.trim() ?? "";
  const hourWheel = picker.getByRole("spinbutton", {
    name: `${label} 시`,
  });

  await hourWheel.focus();
  await hourWheel.press("Home");

  for (let current = 1; current < twelveHour; current += 1) {
    await hourWheel.press("ArrowDown");
  }

  await expect(hourWheel).toHaveAttribute(
    "aria-valuetext",
    `${twelveHour}시`,
  );

  await chooseMinuteByKeyboard(page, id, Number(minuteText));

  const periodGroup = picker.getByRole("radiogroup", {
    name: `${label} 오전 또는 오후`,
  });
  const periodRadio = periodGroup.getByRole("radio", {
    name: period,
    exact: true,
  });

  await periodRadio.click();
  await expect(periodRadio).toHaveAttribute("aria-checked", "true");
  await expect(trigger).toHaveAttribute("data-time-complete", "true");
}

export async function expectTimeValue(
  page: Page,
  id: string,
  value: string,
) {
  const hour = Number(value.slice(0, 2));
  const expected =
    `${hour < 12 ? "오전" : "오후"} ${hour % 12 || 12}:${value.slice(3)}`;

  await expect(page.locator(`#${id}`)).toContainText(expected);
  await expect(page.locator(`#${id}`)).toHaveAttribute(
    "data-time-complete",
    "true",
  );
}
